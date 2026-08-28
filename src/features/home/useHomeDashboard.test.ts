import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))

import { renderHook, waitFor } from '@testing-library/react'
import type { Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { useDataStore } from '@/lib/dataStore'
import { totals } from '@/lib/movimientoStats'
import { useHomeDashboard } from '@/features/home/useHomeDashboard'

const mGetRepo = vi.mocked(getRepo)

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

const makeRepo = (opts: {
  movimientos?: Movimiento[]
  config?: Config
  readyError?: unknown
}): Repo =>
  ({
    ready: vi.fn().mockImplementation(() => {
      if (opts.readyError) return Promise.reject(opts.readyError)
      return Promise.resolve()
    }),
    movimientos: { list: vi.fn().mockResolvedValue({ items: opts.movimientos ?? [] }) },
    activos: { list: vi.fn().mockResolvedValue({ items: [] }) },
    getConfig: vi.fn().mockResolvedValue(opts.config ?? CONFIG_SEMILLA),
    updateConfig: vi.fn(),
  }) as unknown as Repo

beforeEach(() => {
  vi.clearAllMocks()
  useDataStore.setState({ movimientos: [], activos: [], config: null, status: 'idle', error: null })
})

describe('useHomeDashboard', () => {
  it('starts loading and triggers dataStore.load() on mount', async () => {
    const repo = makeRepo({})
    mGetRepo.mockReturnValue(repo)

    const { result } = renderHook(() => useHomeDashboard())
    expect(result.current.status === 'idle' || result.current.status === 'loading').toBe(true)

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(repo.movimientos.list).toHaveBeenCalledTimes(1)
  })

  it('exposes Config.categorias for MovimientoRow to resolve `categoria` ids against', async () => {
    const config: Config = { ...CONFIG_SEMILLA, categorias: [] }
    mGetRepo.mockReturnValue(makeRepo({ config }))
    const { result } = renderHook(() => useHomeDashboard())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.categorias).toEqual([])
  })

  it('falls back to CONFIG_SEMILLA.categorias before Config has loaded', () => {
    mGetRepo.mockReturnValue(makeRepo({}))
    const { result } = renderHook(() => useHomeDashboard())

    expect(result.current.categorias).toEqual(CONFIG_SEMILLA.categorias)
  })

  it('marks isEmpty only once ready with zero movimientos', async () => {
    mGetRepo.mockReturnValue(makeRepo({ movimientos: [] }))
    const { result } = renderHook(() => useHomeDashboard())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.isEmpty).toBe(true)
  })

  it("Home's all-time totals equal movimientoStats.totals() for the same movimientos", async () => {
    const movimientos = [
      movimiento({ tipo: 'ingreso', monto: 500_000 }),
      movimiento({ tipo: 'gasto', monto: 120_000, fecha: '2026-01-01' }),
      movimiento({ tipo: 'gasto', monto: 30_000, fecha: '2020-05-05' }),
    ]
    mGetRepo.mockReturnValue(makeRepo({ movimientos }))

    const { result } = renderHook(() => useHomeDashboard())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.totals).toEqual(
      totals(movimientos, CONFIG_SEMILLA.preferencias.monedaPrincipal),
    )
  })

  it('surfaces a load failure as a RepoErrorCode, and retry() re-fetches', async () => {
    mGetRepo.mockReturnValue(makeRepo({ readyError: new RepoError('down', 'network') }))
    const { result } = renderHook(() => useHomeDashboard())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('network')

    mGetRepo.mockReturnValue(makeRepo({ movimientos: [movimiento()] }))
    result.current.retry()

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.isEmpty).toBe(false)
  })

  it('falls back to CONFIG_SEMILLA preferencias when config has not loaded yet', () => {
    const { result } = renderHook(() => useHomeDashboard())
    expect(result.current.moneda).toBe(CONFIG_SEMILLA.preferencias.monedaPrincipal)
  })

  it('produces exactly 7 week-strip days and 7 chart buckets', async () => {
    mGetRepo.mockReturnValue(makeRepo({}))
    const { result } = renderHook(() => useHomeDashboard())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.weekStripDays).toHaveLength(7)
    expect(result.current.week.chart).toHaveLength(7)
  })

  describe('currency-correct totals', () => {
    it('excludes movements in a currency other than monedaPrincipal from the totals', async () => {
      const config: Config = {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: 'USD' },
      }
      const movimientos = [
        movimiento({ tipo: 'ingreso', monto: 500_000, moneda: 'COP' }),
        movimiento({ tipo: 'ingreso', monto: 100, moneda: 'USD' }),
      ]
      mGetRepo.mockReturnValue(makeRepo({ movimientos, config }))

      const { result } = renderHook(() => useHomeDashboard())
      await waitFor(() => expect(result.current.status).toBe('ready'))

      expect(result.current.totals).toEqual({ ingresos: 100, gastos: 0, balance: 100 })
    })

    it('totals zero, correctly, when nothing matches monedaPrincipal yet', async () => {
      const config: Config = {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: 'USD' },
      }
      const movimientos = [movimiento({ tipo: 'ingreso', monto: 500_000, moneda: 'COP' })]
      mGetRepo.mockReturnValue(makeRepo({ movimientos, config }))

      const { result } = renderHook(() => useHomeDashboard())
      await waitFor(() => expect(result.current.status).toBe('ready'))

      expect(result.current.totals).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
      expect(result.current.otherCurrencies).toEqual(['COP'])
    })

    it('exposes an empty otherCurrencies when every movement matches monedaPrincipal', async () => {
      const movimientos = [movimiento({ tipo: 'ingreso', monto: 500_000, moneda: 'COP' })]
      mGetRepo.mockReturnValue(makeRepo({ movimientos }))

      const { result } = renderHook(() => useHomeDashboard())
      await waitFor(() => expect(result.current.status).toBe('ready'))

      expect(result.current.otherCurrencies).toEqual([])
    })
  })
})
