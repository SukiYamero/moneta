import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))
vi.mock('@/lib/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import type { Activo, Categoria, Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { toast } from '@/lib/toastStore'
import { db } from '@/lib/db'
import { __resetNetworkStoreForTests, useNetworkStore } from '@/lib/networkStore'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import { __resetOutboxClockForTests, listPendingOperations } from '@/lib/outbox'
import { useDataStore } from '@/lib/dataStore'

const mGetRepo = vi.mocked(getRepo)
const mToastError = vi.mocked(toast.error)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
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

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Gimnasio',
  icono: 'dumbbell',
  color: 'rose',
  ...overrides,
})

interface FakeRepoOptions {
  movimientos?: Movimiento[]
  activos?: Activo[]
  config?: Config
  readyError?: unknown
}

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
  await db.outbox.clear()
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

  it('reset() clears loaded data and status back to idle', async () => {
    const repo = makeFakeRepo({ movimientos: [movimiento()], activos: [activo()] })
    mGetRepo.mockReturnValue(repo)
    await useDataStore.getState().load()
    expect(useDataStore.getState().status).toBe('ready')

    useDataStore.getState().reset()

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

  it('outbox failure: a repo write that succeeds but fails to queue keeps the result and toasts a distinct "not queued" message, without rolling back', async () => {
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.add).mockImplementation((item) => Promise.resolve(item))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const addSpy = vi.spyOn(db.outbox, 'add').mockRejectedValue(new Error('IDB blocked'))

    await useDataStore.getState().createMovimiento(movimiento())

    expect(useDataStore.getState().movimientos).toHaveLength(1)
    expect(mToastError).toHaveBeenCalledWith('errors:sync.notQueued')
    expect(await listPendingOperations()).toEqual([])

    addSpy.mockRestore()
    warn.mockRestore()
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

  it('is allowed offline, within the window — deleting is terminal, unlike edits', async () => {
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

    await useDataStore.getState().updateConfig({ categorias: [] })

    expect(useDataStore.getState().config).toEqual(CONFIG_SEMILLA)
    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('errors:offline.mutationRestricted')
  })

  it('failure + rollback: reverts to the exact prior config and toasts the mapped code', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockRejectedValue(new RepoError('boom', 'unknown'))

    await useDataStore.getState().updateConfig({ categorias: [] })

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

describe('useDataStore.upsertCategoria', () => {
  it('create: adds the category optimistically, persists via the repo, and enqueues a config put', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const nueva = categoria({ nombre: 'Gimnasio' })
    const merged: Config = { ...CONFIG_SEMILLA, categorias: [...CONFIG_SEMILLA.categorias, nueva] }
    vi.mocked(repo.updateConfig).mockResolvedValue(merged)

    await useDataStore.getState().upsertCategoria(nueva)

    expect(useDataStore.getState().config?.categorias).toContainEqual(nueva)
    expect(repo.updateConfig).toHaveBeenCalledWith({ categorias: merged.categorias })
    expect(mToastError).not.toHaveBeenCalled()

    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation.entity).toBe('config')
    expect(pending[0]?.operation.op).toBe('put')
  })

  it('edit: replaces the existing category by id rather than appending a duplicate', async () => {
    const existing = categoria({ id: 'cat_x', nombre: 'Gimnasio' })
    useDataStore.setState({
      config: { ...CONFIG_SEMILLA, categorias: [...CONFIG_SEMILLA.categorias, existing] },
    })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const renamed = { ...existing, nombre: 'Crossfit' }
    vi.mocked(repo.updateConfig).mockImplementation((patch) =>
      Promise.resolve({ ...CONFIG_SEMILLA, categorias: patch.categorias! }),
    )

    await useDataStore.getState().upsertCategoria(renamed)

    const categorias = useDataStore.getState().config?.categorias ?? []
    expect(categorias.filter((c) => c.id === 'cat_x')).toEqual([renamed])
    expect(categorias).toHaveLength(CONFIG_SEMILLA.categorias.length + 1)
  })

  it('refusal: settings changes are refused offline', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    useNetworkStore.setState({ online: false, lastOnlineAt: Date.now() })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().upsertCategoria(categoria())

    expect(useDataStore.getState().config).toEqual(CONFIG_SEMILLA)
    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('errors:offline.mutationRestricted')
  })

  it('failure + rollback: reverts to the exact prior config and toasts the mapped code', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockRejectedValue(new RepoError('boom', 'unknown'))

    await useDataStore.getState().upsertCategoria(categoria())

    expect(useDataStore.getState().config).toEqual(CONFIG_SEMILLA)
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.unknown')
    expect(await listPendingOperations()).toEqual([])
  })

  it('two categories created in the same tick both land: no lost update', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    let serverConfig: Config = CONFIG_SEMILLA
    vi.mocked(repo.updateConfig).mockImplementation((patch) => {
      serverConfig = { ...serverConfig, ...patch }
      return Promise.resolve(serverConfig)
    })
    const a = categoria({ nombre: 'a' })
    const b = categoria({ nombre: 'b' })

    await Promise.all([
      useDataStore.getState().upsertCategoria(a),
      useDataStore.getState().upsertCategoria(b),
    ])

    const ids = useDataStore.getState().config?.categorias.map((c) => c.id) ?? []
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]))
    expect(ids).toHaveLength(CONFIG_SEMILLA.categorias.length + 2)
  })

  it('a slow failing upsert rolling back must not erase a concurrent one that already succeeded', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const a = categoria({ nombre: 'a' })
    const b = categoria({ nombre: 'b' })

    let rejectA: (e: unknown) => void = () => {}
    const pendingA = new Promise<Config>((_resolve, reject) => {
      rejectA = reject
    })
    let calls = 0
    vi.mocked(repo.updateConfig).mockImplementation((patch) => {
      calls += 1
      if (calls === 1) return pendingA
      return Promise.resolve({ ...CONFIG_SEMILLA, categorias: patch.categorias! })
    })

    const callA = useDataStore.getState().upsertCategoria(a)
    const callB = useDataStore.getState().upsertCategoria(b)
    await callB

    expect(useDataStore.getState().config?.categorias.map((c) => c.nombre)).toContain('b')

    rejectA(new RepoError('boom', 'unknown'))
    await callA

    const nombres = useDataStore.getState().config?.categorias.map((c) => c.nombre) ?? []
    expect(nombres).toContain('b')
    expect(nombres).not.toContain('a')
  })
})

describe('useDataStore.archiveCategoria', () => {
  it('not found: toasts and never calls the repo', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().archiveCategoria('missing')

    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.notFound')
  })

  it('refuses to archive the last non-archived category, leaving the picker empty', async () => {
    const onlyOne: Config = {
      ...CONFIG_SEMILLA,
      categorias: [categoria({ id: 'cat_only' })],
    }
    useDataStore.setState({ config: onlyOne })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().archiveCategoria('cat_only')

    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('tags:errors.lastCategory')
    expect(useDataStore.getState().config?.categorias[0]?.archivado).not.toBe(true)
  })

  it('allows archiving when another non-archived category remains', async () => {
    const config: Config = {
      ...CONFIG_SEMILLA,
      categorias: [categoria({ id: 'cat_a' }), categoria({ id: 'cat_b' })],
    }
    useDataStore.setState({ config })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockImplementation((patch) =>
      Promise.resolve({ ...config, categorias: patch.categorias! }),
    )

    await useDataStore.getState().archiveCategoria('cat_a')

    const categorias = useDataStore.getState().config?.categorias ?? []
    expect(categorias.find((c) => c.id === 'cat_a')?.archivado).toBe(true)
    expect(categorias.find((c) => c.id === 'cat_b')?.archivado).not.toBe(true)
    expect(mToastError).not.toHaveBeenCalled()
  })

  it('failure + rollback: reverts to the exact prior config and toasts the mapped code', async () => {
    const config: Config = {
      ...CONFIG_SEMILLA,
      categorias: [categoria({ id: 'cat_a' }), categoria({ id: 'cat_b' })],
    }
    useDataStore.setState({ config })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockRejectedValue(new RepoError('down', 'network'))

    await useDataStore.getState().archiveCategoria('cat_a')

    expect(useDataStore.getState().config).toEqual(config)
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.network')
  })
})

describe('useDataStore.deleteCategoria', () => {
  it('not found: toasts and never calls the repo', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA, movimientos: [] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().deleteCategoria('missing')

    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.notFound')
  })

  it('refuses to delete a category referenced by a movimiento', async () => {
    const target = categoria({ id: 'cat_used' })
    useDataStore.setState({
      config: { ...CONFIG_SEMILLA, categorias: [target] },
      movimientos: [movimiento({ categoria: 'cat_used' })],
    })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)

    await useDataStore.getState().deleteCategoria('cat_used')

    expect(repo.updateConfig).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('tags:errors.categoryInUse')
    expect(useDataStore.getState().config?.categorias).toContainEqual(target)
  })

  it('deletes a category never used by any movimiento', async () => {
    const target = categoria({ id: 'cat_unused' })
    const config: Config = { ...CONFIG_SEMILLA, categorias: [target] }
    useDataStore.setState({ config, movimientos: [] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockImplementation((patch) =>
      Promise.resolve({ ...config, categorias: patch.categorias! }),
    )

    await useDataStore.getState().deleteCategoria('cat_unused')

    expect(useDataStore.getState().config?.categorias).toEqual([])
    expect(mToastError).not.toHaveBeenCalled()

    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation.entity).toBe('config')
  })

  it('failure + rollback: reverts to the exact prior config and toasts the mapped code', async () => {
    const target = categoria({ id: 'cat_unused' })
    const config: Config = { ...CONFIG_SEMILLA, categorias: [target] }
    useDataStore.setState({ config, movimientos: [] })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockRejectedValue(new RepoError('boom', 'unknown'))

    await useDataStore.getState().deleteCategoria('cat_unused')

    expect(useDataStore.getState().config).toEqual(config)
    expect(mToastError).toHaveBeenCalledWith('home:error.codes.unknown')
  })
})

const withEchoingWrites = (repo: Repo): Repo => {
  vi.mocked(repo.movimientos.add).mockImplementation(async (m) => m)
  vi.mocked(repo.movimientos.update).mockImplementation(async (id, patch) => ({
    ...movimiento({ id }),
    ...patch,
  }))
  vi.mocked(repo.movimientos.remove).mockResolvedValue(undefined)
  vi.mocked(repo.updateConfig).mockImplementation(async (patch) => ({
    ...CONFIG_SEMILLA,
    ...patch,
  }))
  return repo
}

describe('mutations report whether they committed', () => {
  it('createMovimiento resolves true on success and false when refused offline', async () => {
    const repo = withEchoingWrites(makeFakeRepo())
    mGetRepo.mockReturnValue(repo)

    await expect(useDataStore.getState().createMovimiento(movimiento())).resolves.toBe(true)

    useNetworkStore.setState({ online: false, lastOnlineAt: 0 })
    await expect(useDataStore.getState().createMovimiento(movimiento())).resolves.toBe(false)
  })

  it('createMovimiento resolves false when the repo write fails', async () => {
    const repo = withEchoingWrites(makeFakeRepo())
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.movimientos.add).mockRejectedValue(new RepoError('boom', 'unknown'))

    await expect(useDataStore.getState().createMovimiento(movimiento())).resolves.toBe(false)
  })

  it('updateMovimiento and deleteMovimiento report the same way, including the not-found path', async () => {
    const existing = movimiento()
    const repo = withEchoingWrites(makeFakeRepo({ movimientos: [existing] }))
    mGetRepo.mockReturnValue(repo)
    await useDataStore.getState().load()

    await expect(
      useDataStore.getState().updateMovimiento(existing.id, { monto: 2000 }),
    ).resolves.toBe(true)
    await expect(useDataStore.getState().updateMovimiento('nope', { monto: 1 })).resolves.toBe(
      false,
    )
    await expect(useDataStore.getState().deleteMovimiento(existing.id)).resolves.toBe(true)
    await expect(useDataStore.getState().deleteMovimiento('nope')).resolves.toBe(false)
  })

  it('updateConfig reports the same way', async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = withEchoingWrites(makeFakeRepo())
    mGetRepo.mockReturnValue(repo)

    await expect(
      useDataStore.getState().updateConfig({ preferencias: CONFIG_SEMILLA.preferencias }),
    ).resolves.toBe(true)

    useNetworkStore.setState({ online: false, lastOnlineAt: 0 })
    await expect(
      useDataStore.getState().updateConfig({ preferencias: CONFIG_SEMILLA.preferencias }),
    ).resolves.toBe(false)
  })
})

describe('useDataStore.updateConfig — concurrent writes', () => {
  it("a slow updateConfig's success must not erase a category a concurrent write already committed", async () => {
    useDataStore.setState({ config: CONFIG_SEMILLA })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    const nueva = categoria({ nombre: 'Gimnasio' })

    let resolvePrefs: (config: Config) => void = () => {}
    const pendingPrefs = new Promise<Config>((resolve) => {
      resolvePrefs = resolve
    })
    vi.mocked(repo.updateConfig).mockImplementation((patch) => {
      if (patch.preferencias) return pendingPrefs
      return Promise.resolve({ ...CONFIG_SEMILLA, categorias: patch.categorias! })
    })

    const prefsCall = useDataStore
      .getState()
      .updateConfig({ preferencias: { ...CONFIG_SEMILLA.preferencias, primerDiaSemana: 0 } })
    await useDataStore.getState().upsertCategoria(nueva)

    expect(useDataStore.getState().config?.categorias.map((c) => c.nombre)).toContain('Gimnasio')

    resolvePrefs({
      ...CONFIG_SEMILLA,
      preferencias: { ...CONFIG_SEMILLA.preferencias, primerDiaSemana: 0 },
    })
    await prefsCall

    const nombres = useDataStore.getState().config?.categorias.map((c) => c.nombre) ?? []
    expect(nombres).toContain('Gimnasio')
    expect(useDataStore.getState().config?.preferencias.primerDiaSemana).toBe(0)
  })
})

describe('useDataStore.updateConfig — idioma round-trips through undefined', () => {
  it('"seguir el dispositivo" writes idioma: undefined, and the store ends up with no idioma — not the previous value', async () => {
    useDataStore.setState({
      config: { ...CONFIG_SEMILLA, preferencias: { ...CONFIG_SEMILLA.preferencias, idioma: 'en' } },
    })
    const repo = makeFakeRepo()
    mGetRepo.mockReturnValue(repo)
    vi.mocked(repo.updateConfig).mockImplementation((patch) =>
      Promise.resolve({
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, ...patch.preferencias },
      }),
    )

    await useDataStore
      .getState()
      .updateConfig({ preferencias: { ...CONFIG_SEMILLA.preferencias, idioma: undefined } })

    const preferencias = useDataStore.getState().config?.preferencias
    expect(preferencias?.idioma).toBeUndefined()
    expect(preferencias && 'idioma' in preferencias).toBe(true)
  })
})
