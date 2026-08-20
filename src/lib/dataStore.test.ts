import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))
vi.mock('@/lib/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import type { Activo, Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { toast } from '@/lib/toastStore'
import { __resetNetworkStoreForTests, useNetworkStore } from '@/lib/networkStore'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import { __resetOutboxClockForTests, listPendingOperations, outboxDb } from '@/lib/outbox'
import { useDataStore } from '@/lib/dataStore'

const mGetRepo = vi.mocked(getRepo)
const mToastError = vi.mocked(toast.error)

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
  useNetworkStore.setState({ online: true, lastOnlineAt: null })
})

afterEach(async () => {
  __resetNetworkStoreForTests()
  __resetOutboxClockForTests()
  __resetDeviceIdForTests()
  await outboxDb.entries.clear()
  await deviceDb.deviceId.clear()
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

describe('useDataStore.createMovimiento', () => {
  it('success: optimistically adds the movement, mints id/createdAt, persists via the repo, and enqueues a put', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.add).mockImplementation((item) => Promise.resolve(item))

    await useDataStore.getState().createMovimiento({
      fecha: '2026-08-19',
      seccion: 'sec_personal',
      categoria: 'cat_sueldo',
      tipo: 'ingreso',
      monto: 5000,
      moneda: 'COP',
    })

    const s = useDataStore.getState()
    expect(s.movimientos).toHaveLength(1)
    expect(s.movimientos[0]).toMatchObject({ monto: 5000, moneda: 'COP' })
    expect(s.movimientos[0]?.id).toBeTruthy()
    expect(s.movimientos[0]?.createdAt).toBeTruthy()
    expect(repo.movimientos.add).toHaveBeenCalledWith(s.movimientos[0])
    expect(mToastError).not.toHaveBeenCalled()

    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation).toEqual({
      entity: 'movimiento',
      op: 'put',
      payload: s.movimientos[0],
    })
    expect(pending[0]?.basedOn).toBeNull()
  })

  it('refusal: past the offline window, refuses without touching the repo or the store', async () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: 0 })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().createMovimiento(movimiento())

    expect(useDataStore.getState().movimientos).toEqual([])
    expect(repo.movimientos.add).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('errors:offline.windowExpired.title')
    expect(await listPendingOperations()).toEqual([])
  })

  it('failure + rollback: a repo rejection removes the optimistic entry and toasts the mapped code', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.add).mockRejectedValue(new RepoError('bad monto', 'invalid_input'))

    await useDataStore.getState().createMovimiento(movimiento())

    expect(useDataStore.getState().movimientos).toEqual([])
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.invalidInput')
    expect(await listPendingOperations()).toEqual([])
  })
})

describe('useDataStore.updateMovimiento', () => {
  it('not found: toasts and never calls the repo', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().updateMovimiento('missing', { monto: 1 })

    expect(repo.movimientos.update).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.notFound')
  })

  it('success: patches optimistically, reconciles with the repo result, and enqueues a full-record put', async () => {
    const existing = movimiento({ monto: 1000 })
    useDataStore.setState({ movimientos: [existing] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const merged = { ...existing, monto: 2500 }
    vi.mocked(repo.movimientos.update).mockResolvedValue(merged)

    await useDataStore.getState().updateMovimiento(existing.id, { monto: 2500 })

    expect(useDataStore.getState().movimientos).toEqual([merged])
    expect(repo.movimientos.update).toHaveBeenCalledWith(existing.id, { monto: 2500 })

    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation).toEqual({ entity: 'movimiento', op: 'put', payload: merged })
  })

  it('refusal: edits are refused offline regardless of the window', async () => {
    const existing = movimiento({ monto: 1000 })
    useDataStore.setState({ movimientos: [existing] })
    useNetworkStore.setState({ online: false, lastOnlineAt: Date.now() })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().updateMovimiento(existing.id, { monto: 2500 })

    expect(useDataStore.getState().movimientos).toEqual([existing])
    expect(repo.movimientos.update).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('errors:offline.mutationRestricted')
  })

  it('failure + rollback: reverts to the exact prior record and toasts the mapped code', async () => {
    const existing = movimiento({ monto: 1000 })
    useDataStore.setState({ movimientos: [existing] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.update).mockRejectedValue(new RepoError('gone', 'not_found'))

    await useDataStore.getState().updateMovimiento(existing.id, { monto: 2500 })

    expect(useDataStore.getState().movimientos).toEqual([existing])
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.notFound')
    expect(await listPendingOperations()).toEqual([])
  })
})

describe('useDataStore.deleteMovimiento', () => {
  it('not found: toasts and never calls the repo', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().deleteMovimiento('missing')

    expect(repo.movimientos.remove).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.notFound')
  })

  it('success: removes optimistically, persists via the repo, and enqueues a del carrying just the id', async () => {
    const existing = movimiento()
    useDataStore.setState({ movimientos: [existing] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.remove).mockResolvedValue(undefined)

    await useDataStore.getState().deleteMovimiento(existing.id)

    expect(useDataStore.getState().movimientos).toEqual([])
    expect(repo.movimientos.remove).toHaveBeenCalledWith(existing.id)

    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation).toEqual({
      entity: 'movimiento',
      op: 'del',
      payload: { id: existing.id },
    })
  })

  it('is allowed offline, within the window (deleting is terminal — specs.md §11, 2026-08-19)', async () => {
    const existing = movimiento()
    useDataStore.setState({ movimientos: [existing] })
    useNetworkStore.setState({ online: false, lastOnlineAt: Date.now() })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.remove).mockResolvedValue(undefined)

    await useDataStore.getState().deleteMovimiento(existing.id)

    expect(useDataStore.getState().movimientos).toEqual([])
    expect(repo.movimientos.remove).toHaveBeenCalledWith(existing.id)
  })

  it('refusal: refused past the offline window, item stays', async () => {
    const existing = movimiento()
    useDataStore.setState({ movimientos: [existing] })
    useNetworkStore.setState({ online: false, lastOnlineAt: 0 })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().deleteMovimiento(existing.id)

    expect(useDataStore.getState().movimientos).toEqual([existing])
    expect(repo.movimientos.remove).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('errors:offline.windowExpired.title')
  })

  it('failure + rollback: a repo rejection reinserts the item and toasts the mapped code', async () => {
    const existing = movimiento()
    useDataStore.setState({ movimientos: [existing] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.remove).mockRejectedValue(new RepoError('down', 'network'))

    await useDataStore.getState().deleteMovimiento(existing.id)

    expect(useDataStore.getState().movimientos).toEqual([existing])
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.network')
    expect(await listPendingOperations()).toEqual([])
  })
})

describe('useDataStore.updateConfig', () => {
  it('success: shallow-merges optimistically, reconciles with the repo result, and enqueues a config put', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const merged: Config = {
      ...CONFIG_SEMILLA,
      preferencias: { ...CONFIG_SEMILLA.preferencias, tema: 'oscuro' },
    }
    vi.mocked(repo.updateConfig).mockResolvedValue(merged)

    await useDataStore.getState().updateConfig({ preferencias: merged.preferencias })

    expect(useDataStore.getState().config).toEqual(merged)
    expect(repo.updateConfig).toHaveBeenCalledWith({ preferencias: merged.preferencias })

    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation).toEqual({ entity: 'config', op: 'put', payload: merged })
  })

  it('refusal: settings changes are refused offline', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    useNetworkStore.setState({ online: false, lastOnlineAt: Date.now() })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().updateConfig({ secciones: [] })

    expect(useDataStore.getState().config).toEqual(CONFIG_SEMILLA)
    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('errors:offline.mutationRestricted')
  })

  it('failure + rollback: reverts to the exact prior config and toasts the mapped code', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockRejectedValue(new RepoError('boom', 'unknown'))

    await useDataStore.getState().updateConfig({ secciones: [] })

    expect(useDataStore.getState().config).toEqual(CONFIG_SEMILLA)
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.unknown')
    expect(await listPendingOperations()).toEqual([])
  })
})

describe('useDataStore — concurrent mutations', () => {
  it('two concurrent creates both land: no lost update', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.add).mockImplementation((item) => Promise.resolve(item))
    const a = movimiento({ nota: 'a' })
    const b = movimiento({ nota: 'b' })

    await Promise.all([
      useDataStore.getState().createMovimiento(a),
      useDataStore.getState().createMovimiento(b),
    ])

    const ids = useDataStore.getState().movimientos.map((m) => m.nota)
    expect(ids).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('a failed create rolling back never removes an unrelated concurrent success', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const ok = movimiento({ nota: 'ok' })
    const bad = movimiento({ nota: 'bad' })
    vi.mocked(repo.movimientos.add).mockImplementation((item) =>
      item.nota === 'bad'
        ? Promise.reject(new RepoError('bad monto', 'invalid_input'))
        : Promise.resolve(item),
    )

    await Promise.all([
      useDataStore.getState().createMovimiento(ok),
      useDataStore.getState().createMovimiento(bad),
    ])

    const notas = useDataStore.getState().movimientos.map((m) => m.nota)
    expect(notas).toEqual(['ok'])
  })
})
