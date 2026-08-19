import { create } from 'zustand'
import type { Activo, Config, Movimiento } from '@/lib/schema'
import { RepoError, type RepoErrorCode } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error'

type DataState = {
  movimientos: Movimiento[]
  activos: Activo[]
  config: Config | null
  status: DataStatus
  error: RepoErrorCode | null
  load: () => Promise<void>
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
}))
