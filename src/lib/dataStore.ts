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
//     second, independent write succeeding. enqueueOperation() is itself
//     self-catching (outbox.ts) and can't throw, so it can safely sit
//     inside this same try without an outbox hiccup ever triggering a
//     rollback of a write that actually succeeded. See docs/wave-3/t.md for
//     the full repo-vs-outbox ordering rationale.
//  4. A repo failure rolls the store back to its exact prior value and
//     raises a Toast — never inline, because this is a store, not a form
//     (docs/error-handling.md §7: "anything raised from a store rather
//     than a form"). It never throws past the action, matching load()'s
//     own contract.
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
  try {
    const result = await write()
    await enqueueOperation(onSuccess(result))
  } catch (e) {
    rollback()
    const code = e instanceof RepoError ? e.code : 'unknown'
    toast.error(WRITE_ERROR_TOAST_KEY[code])
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
