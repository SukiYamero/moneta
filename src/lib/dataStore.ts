import { create } from 'zustand'
import type { Activo, Categoria, Config, Movimiento } from '@/lib/schema'
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
  /** Back to the pre-load shape (specs.md §10.28): the boot sequence calls this before re-`load()`ing on a profile rebind, so a previous profile's rows are never shown — even transiently — under the newly-bound one. */
  reset: () => void
  createMovimiento: (input: Omit<Movimiento, 'id' | 'createdAt'>) => Promise<boolean>
  updateMovimiento: (id: string, patch: Partial<Omit<Movimiento, 'id'>>) => Promise<boolean>
  deleteMovimiento: (id: string) => Promise<boolean>
  updateConfig: (patch: Partial<Config>) => Promise<boolean>
  /** Create (new id) or edit (existing id) — one action, matching `CategoryFormModal`'s single component for both (specs.md §10.22). */
  upsertCategoria: (categoria: Categoria) => Promise<boolean>
  archiveCategoria: (id: string) => Promise<void>
  /** Only a category with no referencing movimiento may be deleted (specs.md §10.22 Decision 5) — otherwise it must be archived instead. */
  deleteCategoria: (id: string) => Promise<void>
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
): Promise<boolean> => {
  const decision = useNetworkStore.getState().canWrite(kind)
  if (!decision.allowed) {
    toast.error(REFUSAL_TOAST_KEY[decision.reason])
    return false
  }
  applyOptimistic()
  let result: TResult
  try {
    result = await write()
  } catch (e) {
    rollback()
    const code = e instanceof RepoError ? e.code : 'unknown'
    toast.error(WRITE_ERROR_TOAST_KEY[code])
    return false
  }
  const queued = await enqueueOperation(onSuccess(result))
  if (!queued) {
    toast.error('errors:sync.notQueued')
  }
  // The local write committed and the user is already looking at it — a
  // queueing failure is reported (above) but does not make this a failure
  // from the caller's point of view, which is only ever asking "may I close
  // the form and discard what was typed?".
  return true
}

// Replaces the row with a matching id, or appends when there is none —
// shared by upsertCategoria/archiveCategoria/deleteCategoria's optimistic
// apply *and* their onSuccess so both read the freshest `categorias` array
// available at the moment they run, never a value captured earlier (specs.md
// §10.22's first edge case: two categories created in the same tick must not
// let one write's stale array silently drop the other's).
const upsertById = (categorias: Categoria[], next: Categoria): Categoria[] =>
  categorias.some((c) => c.id === next.id)
    ? categorias.map((c) => (c.id === next.id ? next : c))
    : [...categorias, next]

// A rollback must undo only *this* call's own change against whatever the
// store holds when the rollback actually fires — never restore a whole
// `previous` snapshot taken at this call's start. Two concurrent categoria
// writes don't only interleave within one JS tick (where Promise.all
// happens to serialize each call's optimistic apply before the next call
// starts) — they settle on real network timing, so a slow write can still
// be pending when an unrelated, later-started write has already fully
// succeeded. Restoring a stale snapshot at that point would erase the
// other write's already-committed category, the same failure class
// `deleteMovimiento`'s rollback (re-append, not re-splice) already avoids
// for movimientos. `prior === undefined` means this call created the
// category, so undoing it means removing it, not restoring nothing.
const revertOne = (
  categorias: Categoria[],
  id: string,
  prior: Categoria | undefined,
): Categoria[] => (prior ? upsertById(categorias, prior) : categorias.filter((c) => c.id !== id))

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
  reset: () => set({ movimientos: [], activos: [], config: null, status: 'idle', error: null }),
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
    return runMutation(
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
      return false
    }
    return runMutation(
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
      return false
    }
    return runMutation(
      'delete',
      () => set((state) => ({ movimientos: state.movimientos.filter((m) => m.id !== id) })),
      () => set((state) => ({ movimientos: [...state.movimientos, previous] })),
      () => getRepo().movimientos.remove(id),
      () => ({ entity: 'movimiento', op: 'del', payload: { id } }),
    )
  },

  updateConfig: async (patch) => {
    const previous = get().config
    return runMutation(
      'settings',
      () =>
        set((state) => ({
          config: state.config ? { ...state.config, ...patch } : state.config,
        })),
      () => set({ config: previous }),
      () => getRepo().updateConfig(patch),
      (result) => {
        // Merge only the keys this call actually patched, into whatever is in
        // the store *now* — never `set({ config: result })`. `result` is the
        // Config as the repo saw it at this write; a concurrent write that
        // landed in between is already in the store and is not in `result`,
        // so a blind replace silently drops it (specs.md §12, reproduced by
        // dataStore.test.ts's concurrent-writes case). Same rule the three
        // category actions already follow.
        const patched = Object.fromEntries(
          Object.keys(patch).map((key) => [key, result[key as keyof Config]]),
        ) as Partial<Config>
        set((state) => ({ config: state.config ? { ...state.config, ...patched } : result }))
        return { entity: 'config', op: 'put', payload: get().config ?? result }
      },
    )
  },

  upsertCategoria: async (categoria) => {
    const previous = get().config
    if (!previous) return false
    const prior = previous.categorias.find((c) => c.id === categoria.id)
    return runMutation(
      'settings',
      () =>
        set((state) =>
          state.config
            ? {
                config: {
                  ...state.config,
                  categorias: upsertById(state.config.categorias, categoria),
                },
              }
            : state,
        ),
      () =>
        set((state) =>
          state.config
            ? {
                config: {
                  ...state.config,
                  categorias: revertOne(state.config.categorias, categoria.id, prior),
                },
              }
            : state,
        ),
      // Read fresh, right when the write fires (after the optimistic apply
      // above already ran) — never the `previous` snapshot captured before
      // it, which is exactly the stale-array read-modify-write §10.22 warns
      // against.
      () => getRepo().updateConfig({ categorias: (get().config ?? previous).categorias }),
      (result) => {
        // A per-id merge, not `set({ config: result })`: `result` is *this*
        // write's own return value, dispatched from whatever the store held
        // at the moment this call's write() fired. If a second, concurrent
        // categoria write settles out of order, blindly trusting `result`
        // here would silently clobber it — the same reason
        // `createMovimiento`'s onSuccess merges by id into the array instead
        // of replacing it wholesale.
        const base = get().config ?? result
        const merged: Config = { ...base, categorias: upsertById(base.categorias, categoria) }
        set({ config: merged })
        return { entity: 'config', op: 'put', payload: merged }
      },
    )
  },

  archiveCategoria: async (id) => {
    const previous = get().config
    if (!previous) return
    const target = previous.categorias.find((c) => c.id === id)
    if (!target) {
      toast.error(WRITE_ERROR_TOAST_KEY.not_found)
      return
    }
    // The picker must never end up with nowhere to file a movement (specs.md
    // §10.22 edge cases) — checked against the freshest config, not `target`
    // alone, since another category could have been archived moments ago.
    const stillActiveWithoutThis = previous.categorias.some(
      (c) => c.id !== id && c.archivado !== true,
    )
    if (!stillActiveWithoutThis) {
      toast.error('tags:errors.lastCategory')
      return
    }
    const archive = (categorias: Categoria[]): Categoria[] =>
      upsertById(categorias, { ...target, archivado: true })
    await runMutation(
      'settings',
      () =>
        set((state) =>
          state.config
            ? { config: { ...state.config, categorias: archive(state.config.categorias) } }
            : state,
        ),
      () =>
        set((state) =>
          state.config
            ? {
                config: {
                  ...state.config,
                  categorias: upsertById(state.config.categorias, target),
                },
              }
            : state,
        ),
      () => getRepo().updateConfig({ categorias: archive((get().config ?? previous).categorias) }),
      (result) => {
        const base = get().config ?? result
        const merged: Config = { ...base, categorias: archive(base.categorias) }
        set({ config: merged })
        return { entity: 'config', op: 'put', payload: merged }
      },
    )
  },

  deleteCategoria: async (id) => {
    const previous = get().config
    if (!previous) return
    const target = previous.categorias.find((c) => c.id === id)
    if (!target) {
      toast.error(WRITE_ERROR_TOAST_KEY.not_found)
      return
    }
    // A category referenced by any movimiento must be archived, never hard-
    // deleted (specs.md §10.22 Decision 5) — deleting it would orphan every
    // movement that names it, exactly the failure the id reference exists
    // to prevent.
    const inUse = get().movimientos.some((m) => m.categoria === id)
    if (inUse) {
      toast.error('tags:errors.categoryInUse')
      return
    }
    const withoutTarget = (categorias: Categoria[]): Categoria[] =>
      categorias.filter((c) => c.id !== id)
    await runMutation(
      'settings',
      () =>
        set((state) =>
          state.config
            ? { config: { ...state.config, categorias: withoutTarget(state.config.categorias) } }
            : state,
        ),
      () =>
        set((state) =>
          state.config
            ? {
                config: {
                  ...state.config,
                  categorias: upsertById(state.config.categorias, target),
                },
              }
            : state,
        ),
      () =>
        getRepo().updateConfig({
          categorias: withoutTarget((get().config ?? previous).categorias),
        }),
      (result) => {
        const base = get().config ?? result
        const merged: Config = { ...base, categorias: withoutTarget(base.categorias) }
        set({ config: merged })
        return { entity: 'config', op: 'put', payload: merged }
      },
    )
  },
}))
