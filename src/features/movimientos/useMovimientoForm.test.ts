import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))
vi.mock('@/lib/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { act, renderHook, waitFor } from '@testing-library/react'
import type { Categoria, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { db } from '@/lib/db'
import { __resetNetworkStoreForTests, useNetworkStore } from '@/lib/networkStore'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import { __resetOutboxClockForTests } from '@/lib/outbox'
import { useDataStore } from '@/lib/dataStore'
import { formatAmountForInput } from '@/lib/i18n/amountFormat'
import { useMovimientoForm } from '@/features/movimientos/useMovimientoForm'

const mGetRepo = vi.mocked(getRepo)
const LOCALE = 'es-CO'

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

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: 'cat_gimnasio',
  nombre: 'Gimnasio',
  icono: 'dumbbell',
  color: 'rose',
  ...overrides,
})

const makeRepo = (): Repo =>
  ({
    ready: vi.fn().mockResolvedValue(undefined),
    movimientos: {
      add: vi.fn().mockImplementation(async (m: Movimiento) => m),
      update: vi.fn().mockImplementation(async (id: string, patch: Partial<Movimiento>) => ({
        ...movimiento({ id }),
        ...patch,
      })),
      remove: vi.fn(),
    },
    activos: { list: vi.fn().mockResolvedValue({ items: [] }) },
    getConfig: vi.fn().mockResolvedValue(CONFIG_SEMILLA),
    updateConfig: vi.fn(),
  }) as unknown as Repo

beforeEach(() => {
  vi.clearAllMocks()
  useDataStore.setState({ movimientos: [], activos: [], config: null, status: 'idle', error: null })
  useNetworkStore.setState({ online: true, lastOnlineAt: null })
  mGetRepo.mockReturnValue(makeRepo())
})

afterEach(async () => {
  __resetNetworkStoreForTests()
  __resetOutboxClockForTests()
  __resetDeviceIdForTests()
  await db.outbox.clear()
  await deviceDb.deviceId.clear()
})

describe('useMovimientoForm — create mode defaults', () => {
  it('starts with gasto, today, an empty amount/note and no category', () => {
    const onSaved = vi.fn()
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved,
      }),
    )

    expect(result.current.tipo).toBe('gasto')
    expect(result.current.amountRaw).toBe('')
    expect(result.current.nota).toBe('')
    expect(result.current.categoriaId).toBeUndefined()
    expect(result.current.fecha).toBe(new Date().toISOString().slice(0, 10))
    expect(result.current.submitting).toBe(false)
    expect(result.current.amountErrorReason).toBeUndefined()
    expect(result.current.categoriaMissing).toBe(false)
  })
})

describe('useMovimientoForm — edit mode defaults', () => {
  it('prefills every field from the initial movimiento, formatting the amount for the locale', () => {
    const initial = movimiento({
      monto: 18000,
      tipo: 'gasto',
      nota: 'Mercado',
      fecha: '2026-08-10',
    })
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'edit',
        initial,
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )

    expect(result.current.tipo).toBe('gasto')
    expect(result.current.amountRaw).toBe(formatAmountForInput(18000, LOCALE))
    expect(result.current.fecha).toBe('2026-08-10')
    expect(result.current.nota).toBe('Mercado')
    expect(result.current.categoriaId).toBe('cat_sueldo')
  })
})

describe('useMovimientoForm — validation only appears after a submit attempt', () => {
  it('does not show an amount or category error before the user tries to save', () => {
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    expect(result.current.amountErrorReason).toBeUndefined()
    expect(result.current.categoriaMissing).toBe(false)
  })

  it('distinguishes empty, malformed and not_positive on submit, and blocks saving', async () => {
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )

    await act(() => result.current.submit())
    expect(result.current.amountErrorReason).toBe('empty')

    act(() => result.current.setAmountRaw('abc'))
    await act(() => result.current.submit())
    expect(result.current.amountErrorReason).toBe('malformed')

    act(() => result.current.setAmountRaw('0'))
    await act(() => result.current.submit())
    expect(result.current.amountErrorReason).toBe('not_positive')

    expect(repo.movimientos.add).not.toHaveBeenCalled()
  })

  it('flags a missing category on submit, distinct from the amount error', async () => {
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    act(() => result.current.setAmountRaw('18000'))

    await act(() => result.current.submit())

    expect(result.current.amountErrorReason).toBeUndefined()
    expect(result.current.categoriaMissing).toBe(true)
    expect(repo.movimientos.add).not.toHaveBeenCalled()
  })

  it('counts every submit call, including blocked and repeated ones, so a view can react to a fresh attempt', async () => {
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    expect(result.current.submitAttempts).toBe(0)

    await act(() => result.current.submit())
    expect(result.current.submitAttempts).toBe(1)

    await act(() => result.current.submit())
    expect(result.current.submitAttempts).toBe(2)
  })
})

describe('useMovimientoForm — selectCategoria', () => {
  it('sets categoriaId and clears categoriaMissing', async () => {
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    await act(() => result.current.submit())
    expect(result.current.categoriaMissing).toBe(true)

    act(() => result.current.selectCategoria(categoria()))

    expect(result.current.categoriaId).toBe('cat_gimnasio')
    expect(result.current.categoriaMissing).toBe(false)
  })
})

describe('useMovimientoForm — successful create', () => {
  it('writes only categoriaId onto the form and payload from the selected category, then clears the form', async () => {
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    const onSaved = vi.fn()
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved,
      }),
    )

    act(() => result.current.setAmountRaw('18.000'))
    act(() => result.current.selectCategoria(categoria()))
    act(() => result.current.setNota('Pesas'))

    await act(() => result.current.submit())

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(repo.movimientos.add).toHaveBeenCalledTimes(1)
    const written = vi.mocked(repo.movimientos.add).mock.calls[0]?.[0]
    expect(written).toMatchObject({
      monto: 18000,
      categoria: 'cat_gimnasio',
      tipo: 'gasto',
      moneda: 'COP',
      nota: 'Pesas',
    })
    expect(written).not.toHaveProperty('seccion')

    expect(result.current.amountRaw).toBe('')
    expect(result.current.nota).toBe('')
    expect(result.current.categoriaId).toBeUndefined()
  })

  it('omits nota entirely when left blank, rather than writing an empty string', async () => {
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    act(() => result.current.setAmountRaw('5000'))
    act(() => result.current.selectCategoria(categoria()))

    await act(() => result.current.submit())

    const written = vi.mocked(repo.movimientos.add).mock.calls[0]?.[0]
    expect(written?.nota).toBeUndefined()
  })

  it.each([
    ['a newline', 'Almuerzo\ncon el equipo', 'Almuerzo con el equipo'],
    ['a run of spaces and tabs', 'Almuerzo   \t con el equipo', 'Almuerzo con el equipo'],
    [
      'a mix of newlines and spaces at the edges',
      '  Almuerzo\ncon el equipo  \n',
      'Almuerzo con el equipo',
    ],
  ])('collapses %s into a single logical line before writing', async (_case, typed, expected) => {
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    act(() => result.current.setAmountRaw('5000'))
    act(() => result.current.selectCategoria(categoria()))
    act(() => result.current.setNota(typed))

    await act(() => result.current.submit())

    const written = vi.mocked(repo.movimientos.add).mock.calls[0]?.[0]
    expect(written?.nota).toBe(expected)
  })
})

describe('useMovimientoForm — a refused or failed write keeps the sheet open with values intact', () => {
  it('a write refused offline past the window does not call onSaved and keeps the typed values', async () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: 0 })
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    const onSaved = vi.fn()
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved,
      }),
    )
    act(() => result.current.setAmountRaw('18.000'))
    act(() => result.current.selectCategoria(categoria()))
    act(() => result.current.setNota('Pesas'))

    await act(() => result.current.submit())

    expect(onSaved).not.toHaveBeenCalled()
    expect(repo.movimientos.add).not.toHaveBeenCalled()
    expect(result.current.amountRaw).toBe('18.000')
    expect(result.current.nota).toBe('Pesas')
    expect(result.current.categoriaId).toBe('cat_gimnasio')
    expect(result.current.submitting).toBe(false)
  })

  it('a repo failure does not call onSaved and keeps the typed values', async () => {
    const repo = makeRepo()
    vi.mocked(repo.movimientos.add).mockRejectedValue(new RepoError('boom', 'unknown'))
    mGetRepo.mockReturnValue(repo)
    const onSaved = vi.fn()
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved,
      }),
    )
    act(() => result.current.setAmountRaw('18.000'))
    act(() => result.current.selectCategoria(categoria()))

    await act(() => result.current.submit())

    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.amountRaw).toBe('18.000')
    expect(result.current.categoriaId).toBe('cat_gimnasio')
  })
})

describe('useMovimientoForm — double-submit guard', () => {
  it('a second submit while one is already in flight does not write twice', async () => {
    const repo = makeRepo()
    let resolveAdd!: (m: Movimiento) => void
    vi.mocked(repo.movimientos.add).mockImplementation(
      () => new Promise((resolve) => (resolveAdd = resolve)),
    )
    mGetRepo.mockReturnValue(repo)
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )
    act(() => result.current.setAmountRaw('18000'))
    act(() => result.current.selectCategoria(categoria()))

    let firstSubmit!: Promise<void>
    act(() => {
      firstSubmit = result.current.submit()
    })
    await waitFor(() => expect(result.current.submitting).toBe(true))

    await act(() => result.current.submit())

    expect(repo.movimientos.add).toHaveBeenCalledTimes(1)

    resolveAdd(movimiento())
    await act(() => firstSubmit)
  })
})

describe('useMovimientoForm — editing a movement whose category no longer resolves locally', () => {
  it('keeps the original categoria untouched unless the user actively picks a new one', async () => {
    const initial = movimiento({ categoria: 'cat_unresolved' })
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    useDataStore.setState({ movimientos: [initial] })
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'edit',
        initial,
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )

    expect(result.current.categoriaId).toBe('cat_unresolved')
    expect(result.current.categoriaMissing).toBe(false)

    await act(() => result.current.submit())

    const [id, patch] = vi.mocked(repo.movimientos.update).mock.calls[0]!
    expect(id).toBe(initial.id)
    expect(patch.categoria).toBe('cat_unresolved')
  })
})

describe('useMovimientoForm — editing tipo never lets monto go negative in storage', () => {
  it('flips the sign only at render time; the stored monto stays positive', async () => {
    const initial = movimiento({ tipo: 'gasto', monto: 1000 })
    const repo = makeRepo()
    mGetRepo.mockReturnValue(repo)
    useDataStore.setState({ movimientos: [initial] })
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'edit',
        initial,
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )

    act(() => result.current.setTipo('ingreso'))
    await act(() => result.current.submit())

    const patch = vi.mocked(repo.movimientos.update).mock.calls[0]![1]
    expect(patch.tipo).toBe('ingreso')
    expect(patch.monto).toBeGreaterThan(0)
    expect(patch.monto).toBe(1000)
  })
})

describe('useMovimientoForm — applyParsedFields', () => {
  it('sets fields directly without requiring a submit', () => {
    const { result } = renderHook(() =>
      useMovimientoForm({
        mode: 'create',
        locale: LOCALE,
        monedaPrincipal: 'COP',
        onSaved: vi.fn(),
      }),
    )

    act(() =>
      result.current.applyParsedFields({
        tipo: 'ingreso',
        monto: 25000,
        fecha: '2026-08-01',
        nota: 'Freelance',
        categoriaId: 'cat_sueldo',
      }),
    )

    expect(result.current.tipo).toBe('ingreso')
    expect(result.current.amountRaw).toBe(formatAmountForInput(25000, LOCALE))
    expect(result.current.fecha).toBe('2026-08-01')
    expect(result.current.nota).toBe('Freelance')
    expect(result.current.categoriaId).toBe('cat_sueldo')
  })
})
