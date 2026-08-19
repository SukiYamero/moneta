import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))

import type { Activo, Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { useDataStore } from '@/lib/dataStore'

const mGetRepo = vi.mocked(getRepo)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

const activo = (overrides: Partial<Activo> = {}): Activo => ({
  id: crypto.randomUUID(),
  nombre: 'CDT Bancolombia',
  tipo: 'CDT',
  valorActual: 1000,
  moneda: 'COP',
  fechaActualizacion: '2026-08-15',
  ...overrides,
})

interface FakeRepoOptions {
  movimientos?: Movimiento[]
  activos?: Activo[]
  config?: Config
  readyError?: unknown
}

// A stand-in `Repo`, not `repo.fake.ts`'s real one — dataStore must not care
// which implementation `getRepo()` hands it, only call the port. `vi.fn()`
// wrapping each method lets tests assert call counts (race-safety).
const makeFakeRepo = ({
  movimientos = [],
  activos = [],
  config = CONFIG_SEMILLA,
  readyError,
}: FakeRepoOptions = {}): Repo => ({
  ready: vi.fn().mockImplementation(() => {
    if (readyError) return Promise.reject(readyError)
    return Promise.resolve()
  }),
  movimientos: {
    list: vi.fn().mockResolvedValue({ items: movimientos }),
    get: vi.fn(),
    add: vi.fn(),
    addMany: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
  },
  activos: {
    list: vi.fn().mockResolvedValue({ items: activos }),
    get: vi.fn(),
    add: vi.fn(),
    addMany: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
  },
  getConfig: vi.fn().mockResolvedValue(config),
  updateConfig: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  useDataStore.setState({
    movimientos: [],
    activos: [],
    config: null,
    status: 'idle',
    error: null,
  })
})

describe('useDataStore', () => {
  it('starts idle with empty data', () => {
    const s = useDataStore.getState()
    expect(s.status).toBe('idle')
    expect(s.movimientos).toEqual([])
    expect(s.activos).toEqual([])
    expect(s.config).toBeNull()
    expect(s.error).toBeNull()
  })

  it('load() populates movimientos, activos and config from the repo', async () => {
    const m = movimiento()
    const a = activo()
    const repo = makeFakeRepo({ movimientos: [m], activos: [a] })
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().load()

    const s = useDataStore.getState()
    expect(s.status).toBe('ready')
    expect(s.movimientos).toEqual([m])
    expect(s.activos).toEqual([a])
    expect(s.config).toEqual(CONFIG_SEMILLA)
    expect(s.error).toBeNull()
  })

  it('is race-safe: two concurrent load() calls only read the repo once', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await Promise.all([useDataStore.getState().load(), useDataStore.getState().load()])

    expect(repo.movimientos.list).toHaveBeenCalledTimes(1)
    expect(repo.activos.list).toHaveBeenCalledTimes(1)
    expect(repo.getConfig).toHaveBeenCalledTimes(1)
  })

  it('is idempotent: load() after a successful load does not re-read the repo', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().load()
    await useDataStore.getState().load()

    expect(repo.movimientos.list).toHaveBeenCalledTimes(1)
  })

  it('lands a RepoError in `error` as its code, not a raw message, and never throws', async () => {
    const repo = makeFakeRepo({ readyError: new RepoError('drive unreachable', 'network') })
    mGetRepo.mockReturnValue(repo)

    await expect(useDataStore.getState().load()).resolves.toBeUndefined()

    const s = useDataStore.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('network')
  })

  it('falls back to `unknown` for a non-RepoError failure', async () => {
    const repo = makeFakeRepo({ readyError: new Error('boom') })
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().load()

    expect(useDataStore.getState().error).toBe('unknown')
  })

  it('a failed load() can be retried', async () => {
    const failing = makeFakeRepo({ readyError: new RepoError('down', 'network') })
    mGetRepo.mockReturnValue(failing)
    await useDataStore.getState().load()
    expect(useDataStore.getState().status).toBe('error')

    const succeeding = makeFakeRepo({ movimientos: [movimiento()] })
    mGetRepo.mockReturnValue(succeeding)
    await useDataStore.getState().load()

    const s = useDataStore.getState()
    expect(s.status).toBe('ready')
    expect(s.error).toBeNull()
    expect(s.movimientos).toHaveLength(1)
  })

  it('replaces state immutably: the array reference changes on load', async () => {
    const initial = useDataStore.getState().movimientos
    const repo = makeFakeRepo({ movimientos: [movimiento()] })
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().load()

    expect(useDataStore.getState().movimientos).not.toBe(initial)
  })
})
