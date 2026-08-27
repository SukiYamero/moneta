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
  reset: () => void
  createMovimiento: (input: Omit<Movimiento, 'id' | 'createdAt'>) => Promise<boolean>
  updateMovimiento: (id: string, patch: Partial<Omit<Movimiento, 'id'>>) => Promise<boolean>
  deleteMovimiento: (id: string) => Promise<boolean>
  updateConfig: (patch: Partial<Config>) => Promise<boolean>
  upsertCategoria: (categoria: Categoria) => Promise<boolean>
  archiveCategoria: (id: string) => Promise<void>
  deleteCategoria: (id: string) => Promise<void>
}

const REFUSAL_TOAST_KEY: Record<WriteRefusalReason, ToastMessageKey> = {
  offline_mutation_restricted: 'errors:offline.mutationRestricted',
  offline_window_expired: 'errors:offline.windowExpired.title',
}

const WRITE_ERROR_TOAST_KEY: Record<RepoErrorCode, ToastMessageKey> = {
  not_found: 'home:error.codes.notFound',
  schema_mismatch: 'home:error.codes.schemaMismatch',
  invalid_input: 'home:error.codes.invalidInput',
  network: 'home:error.codes.network',
  unknown: 'home:error.codes.unknown',
}

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
  return true
}

const upsertById = (categorias: Categoria[], next: Categoria): Categoria[] =>
  categorias.some((c) => c.id === next.id)
    ? categorias.map((c) => (c.id === next.id ? next : c))
    : [...categorias, next]

const revertOne = (
  categorias: Categoria[],
  id: string,
  prior: Categoria | undefined,
): Categoria[] => (prior ? upsertById(categorias, prior) : categorias.filter((c) => c.id !== id))

export const useDataStore = create<DataState>((set, get) => ({
  movimientos: [],
  activos: [],
  config: null,
  status: 'idle',
  error: null,
  reset: () => set({ movimientos: [], activos: [], config: null, status: 'idle', error: null }),
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
      () => getRepo().updateConfig({ categorias: (get().config ?? previous).categorias }),
      (result) => {
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
