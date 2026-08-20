import { create } from 'zustand'
import type { Activo, Config, Movimiento } from '@/lib/schema'
import { RepoError, type RepoErrorCode } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { type MutationKind, useNetworkStore, type WriteRefusalReason } from '@/lib/networkStore'
import { toast, type ToastMessageKey } from '@/lib/toastStore'
import { enqueueOperation, type OutboxOperation } from '@/lib/outbox'

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error'

type DataState = {
  movimientos: Movimiento[]
  activos: Activo[]
  config: Config | null
  status: DataStatus
  error: RepoErrorCode | null
  load: () => Promise<void>
  createMovimiento: (input: Omit<Movimiento, 'id' | 'createdAt'>) => Promise<void>
  updateMovimiento: (id: string, patch: Partial<Omit<Movimiento, 'id'>>) => Promise<void>
  deleteMovimiento: (id: string) => Promise<void>
  updateConfig: (patch: Partial<Config>) => Promise<void>
}

// The refusal copy Track R wrote (specs.md §10.11) and left unconsumed —
// this is its first caller.
const REFUSAL_TOAST_KEY: Record<WriteRefusalReason, ToastMessageKey> = {
  offline_mutation_restricted: 'errors:offline.mutationRestricted',
  offline_window_expired: 'errors:offline.windowExpired.title',
}

// Reuses the same RepoErrorCode → copy the three read screens already show
// (src/lib/errorCopy.ts, specs.md §10.11's unified error copy) rather than
// minting a parallel set of write-specific strings: "no connection, try
// again" reads the same whether the read or the write is what failed.
const WRITE_ERROR_TOAST_KEY: Record<RepoErrorCode, ToastMessageKey> = {
  not_found: 'home:error.codes.notFound',
  schema_mismatch: 'home:error.codes.schemaMismatch',
  invalid_input: 'home:error.codes.invalidInput',
  network: 'home:error.codes.network',
  unknown: 'home:error.codes.unknown',
}

// The one write convention every mutation below shares (specs.md §10.13):
//  1. canWrite() is consulted exactly once per attempt — the only place the
//     offline policy is enforced (specs.md §10.11/§11 2026-08-19).
//  2. Optimistic apply, so the UI never waits on local storage.
//  3. The repo write lands before the outbox append, never the other way —
//     a change the user is already looking at must never depend on a
//     second, independent write succeeding. A repo failure here rolls the
//     store back to the exact prior record via an inverse transform, not a
//     positional restore — `deleteMovimiento`'s rollback re-appends rather
//     than re-splicing at the original index, which is deliberate: no
//     screen renders `movimientos` in raw store order (every consumer sorts
//     explicitly — `sortByRecency`, `movimientoStats`), and restoring a
//     captured index would be wrong the moment a concurrent mutation has
//     shifted it in between. It also raises a Toast — never inline, because
//     this is a store, not a form (docs/error-handling.md §7: "anything
//     raised from a store rather than a form").
//  4. The outbox append is a *separate* failure domain from the repo write,
//     caught on its own: by the time it runs, the repo write has already
//     succeeded and the user is already looking at the result, so a
//     queueing failure must never roll that back (docs/error-handling.md
//     §3 — one try per operation whose failures mean the same thing to the
//     caller). But it must not be silent either: this app's whole promise
//     is that data reaches the user's Drive, and a write that never queues
//     never will, with nothing else ever noticing. enqueueOperation()
//     reports that back as `false` rather than a success-shaped
//     `Promise<void>` (docs/error-handling.md §4) specifically so this can
//     tell the user their change is safe on this device but not yet queued
//     to sync, instead of that failure living only in a console log.
// It never throws past the action, matching load()'s own contract.
const runMutation = async <TResult>(
  kind: MutationKind,
  applyOptimistic: () => void,
  rollback: () => void,
  write: () => Promise<TResult>,
  onSuccess: (result: TResult) => OutboxOperation,
): Promise<void> => {
  const decision = useNetworkStore.getState().canWrite(kind)
  if (!decision.allowed) {
    toast.error(REFUSAL_TOAST_KEY[decision.reason])
    return
  }
  applyOptimistic()
  let result: TResult
  try {
    result = await write()
  } catch (e) {
    rollback()
    const code = e instanceof RepoError ? e.code : 'unknown'
    toast.error(WRITE_ERROR_TOAST_KEY[code])
    return
  }
  const queued = await enqueueOperation(onSuccess(result))
  if (!queued) {
    toast.error('errors:sync.notQueued')
  }
}

// Raw entities only — no derived totals/breakdowns cached here. Screens
// compute those from movimientoStats at the call site; caching them on the
// store is exactly the drift specs.md §4/AGENTS.md's "single source of
// truth" rule forbids.
export const useDataStore = create<DataState>((set, get) => ({
  movimientos: [],
  activos: [],
  config: null,
  status: 'idle',
  error: null,
  // Idempotent and race-safe: the status check and the 'loading' set happen
  // synchronously, before any await, mirroring authStore.restore()'s guard
  // (src/lib/authStore.ts) — so two calls issued back-to-back in the same
  // tick can't both pass the guard and both fire a read. A prior 'ready'
  // also short-circuits (load-once-per-session); 'idle'/'error' retry.
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return
    set({ status: 'loading', error: null })
    try {
      const repo = getRepo()
      await repo.ready()
      const [movimientosResult, activosResult, config] = await Promise.all([
        repo.movimientos.list(),
        repo.activos.list(),
        repo.getConfig(),
      ])
      set({
        movimientos: movimientosResult.items,
        activos: activosResult.items,
        config,
        status: 'ready',
        error: null,
      })
    } catch (e) {
      // Owns its own error handling end to end (docs/error-handling.md §7):
      // a component calling `void dataStore.load()` never needs a try/catch.
      // Lands as a code, never a raw `.message`, for the UI to translate.
      set({ status: 'error', error: e instanceof RepoError ? e.code : 'unknown' })
    }
  },

  createMovimiento: async (input) => {
    const movimiento: Movimiento = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    await runMutation(
      'create',
      () => set((state) => ({ movimientos: [...state.movimientos, movimiento] })),
      () =>
        set((state) => ({
          movimientos: state.movimientos.filter((m) => m.id !== movimiento.id),
        })),
      () => getRepo().movimientos.add(movimiento),
      (result) => {
        set((state) => ({
          movimientos: state.movimientos.map((m) => (m.id === result.id ? result : m)),
        }))
        return { entity: 'movimiento', op: 'put', payload: result }
      },
    )
  },

  updateMovimiento: async (id, patch) => {
    const previous = get().movimientos.find((m) => m.id === id)
    if (!previous) {
      toast.error(WRITE_ERROR_TOAST_KEY.not_found)
      return
    }
    await runMutation(
      'edit',
      () =>
        set((state) => ({
          movimientos: state.movimientos.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      () =>
        set((state) => ({
          movimientos: state.movimientos.map((m) => (m.id === id ? previous : m)),
        })),
      () => getRepo().movimientos.update(id, patch),
      (result) => {
        set((state) => ({
          movimientos: state.movimientos.map((m) => (m.id === result.id ? result : m)),
        }))
        return { entity: 'movimiento', op: 'put', payload: result }
      },
    )
  },

  deleteMovimiento: async (id) => {
    const previous = get().movimientos.find((m) => m.id === id)
    if (!previous) {
      toast.error(WRITE_ERROR_TOAST_KEY.not_found)
      return
    }
    await runMutation(
      'delete',
      () => set((state) => ({ movimientos: state.movimientos.filter((m) => m.id !== id) })),
      () => set((state) => ({ movimientos: [...state.movimientos, previous] })),
      () => getRepo().movimientos.remove(id),
      () => ({ entity: 'movimiento', op: 'del', payload: { id } }),
    )
  },

  updateConfig: async (patch) => {
    const previous = get().config
    await runMutation(
      'settings',
      () =>
        set((state) => ({
          config: state.config ? { ...state.config, ...patch } : state.config,
        })),
      () => set({ config: previous }),
      () => getRepo().updateConfig(patch),
      (result) => {
        set({ config: result })
        return { entity: 'config', op: 'put', payload: result }
      },
    )
  },
}))
