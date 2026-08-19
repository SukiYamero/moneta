import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Movimiento } from '@/lib/schema'
import { breakdownBy, filterByRange, periodRange, series, totals } from '@/lib/movimientoStats'

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

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('totals()', () => {
  // The float-drift bug: naive `+=` on `monto` produces 0.30000000000000004,
  // not 0.3. This must fail against a naive implementation and pass against
  // one that accumulates in integer minor units (cents) and divides once.
  it('sums 0.1 and 0.2 ingresos to exactly 0.3, not the float-drift result', () => {
    const movimientos = [
      movimiento({ tipo: 'ingreso', monto: 0.1 }),
      movimiento({ tipo: 'ingreso', monto: 0.2 }),
    ]
    expect(totals(movimientos).ingresos).toBe(0.3)
    expect(0.1 + 0.2).not.toBe(0.3) // sanity: the naive sum really does drift
  })

  it('sums a realistic COP set without drift', () => {
    const movimientos = [
      movimiento({ tipo: 'gasto', monto: 333_333.33 }),
      movimiento({ tipo: 'gasto', monto: 666_666.67 }),
    ]
    expect(totals(movimientos).gastos).toBe(1_000_000)
  })

  it('computes balance as ingresos minus gastos', () => {
    const movimientos = [
      movimiento({ tipo: 'ingreso', monto: 500 }),
      movimiento({ tipo: 'gasto', monto: 200 }),
    ]
    expect(totals(movimientos)).toEqual({ ingresos: 500, gastos: 200, balance: 300 })
  })

  it('returns all zeros for an empty list', () => {
    expect(totals([])).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
  })

  it('handles an all-expense set (ingresos stays 0)', () => {
    const movimientos = [movimiento({ tipo: 'gasto', monto: 100 })]
    expect(totals(movimientos)).toEqual({ ingresos: 0, gastos: 100, balance: -100 })
  })
})

describe('periodRange() — timezone safety', () => {
  // The date-shift bug: `new Date('2026-09-01')` parses as UTC midnight, which
  // under a negative-offset TZ (e.g. America/Bogota, UTC-5) is Aug 31 local —
  // one calendar day *and one month* earlier. A naive implementation using
  // `new Date(anchor)` would compute the 'mes' range as Aug 1–31 instead of
  // Sep 1–30. This must fail against that naive implementation.
  it('does not shift a month-boundary anchor under a negative-offset TZ', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const range = periodRange('mes', '2026-09-01', 1)
    expect(range).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('does not shift a day anchor under a negative-offset TZ', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const range = periodRange('dia', '2026-09-01', 1)
    expect(range).toEqual({ from: '2026-09-01', to: '2026-09-01' })
  })

  it('a movement dated on the month boundary lands in the correct month under a negative-offset TZ', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const movimientos = [
      movimiento({ id: 'august', fecha: '2026-08-31' }),
      movimiento({ id: 'september', fecha: '2026-09-01' }),
    ]
    const range = periodRange('mes', '2026-09-01', 1)
    const filtered = filterByRange(movimientos, range)
    expect(filtered.map((m) => m.id)).toEqual(['september'])
  })

  it('week range starts on Monday when primerDiaSemana is 1', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    // 2026-08-19 is a Wednesday.
    const range = periodRange('semana', '2026-08-19', 1)
    expect(range).toEqual({ from: '2026-08-17', to: '2026-08-23' })
  })

  it('week range starts on Sunday when primerDiaSemana is 0', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const range = periodRange('semana', '2026-08-19', 0)
    expect(range).toEqual({ from: '2026-08-16', to: '2026-08-22' })
  })

  it('year range spans the whole calendar year', () => {
    const range = periodRange('anio', '2026-05-10', 1)
    expect(range).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
})

describe('filterByRange()', () => {
  it('includes movements exactly at the from and to bounds (inclusive)', () => {
    const movimientos = [
      movimiento({ id: 'before', fecha: '2026-08-14' }),
      movimiento({ id: 'at-from', fecha: '2026-08-15' }),
      movimiento({ id: 'inside', fecha: '2026-08-18' }),
      movimiento({ id: 'at-to', fecha: '2026-08-21' }),
      movimiento({ id: 'after', fecha: '2026-08-22' }),
    ]
    const filtered = filterByRange(movimientos, { from: '2026-08-15', to: '2026-08-21' })
    expect(filtered.map((m) => m.id)).toEqual(['at-from', 'inside', 'at-to'])
  })

  it('returns an empty array for an empty input', () => {
    expect(filterByRange([], { from: '2026-01-01', to: '2026-12-31' })).toEqual([])
  })
})

describe('breakdownBy()', () => {
  it('groups by seccion, sorted by total desc, shares summing to 1', () => {
    const movimientos = [
      movimiento({ seccion: 'sec_personal', monto: 100 }),
      movimiento({ seccion: 'sec_personal', monto: 200 }),
      movimiento({ seccion: 'sec_trabajo', monto: 100 }),
    ]
    const result = breakdownBy(movimientos, 'seccion')
    expect(result).toEqual([
      { key: 'sec_personal', total: 300, share: 0.75 },
      { key: 'sec_trabajo', total: 100, share: 0.25 },
    ])
  })

  it('filters by tipo before grouping when given', () => {
    const movimientos = [
      movimiento({ seccion: 'sec_personal', tipo: 'ingreso', monto: 500 }),
      movimiento({ seccion: 'sec_personal', tipo: 'gasto', monto: 100 }),
    ]
    const result = breakdownBy(movimientos, 'seccion', 'gasto')
    expect(result).toEqual([{ key: 'sec_personal', total: 100, share: 1 }])
  })

  it('returns an empty array with no NaN shares when the total is zero', () => {
    expect(breakdownBy([], 'seccion')).toEqual([])
  })

  it('groups by categoria as well', () => {
    const movimientos = [
      movimiento({ categoria: 'cat_sueldo', monto: 100 }),
      movimiento({ categoria: 'cat_ventas', monto: 100 }),
    ]
    const result = breakdownBy(movimientos, 'categoria')
    expect(result).toHaveLength(2)
    expect(result.reduce((sum, entry) => sum + entry.share, 0)).toBe(1)
  })
})

describe('series()', () => {
  it('produces one bucket per day for a semana period, including empty days', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const range = periodRange('semana', '2026-08-19', 1)
    const movimientos = [movimiento({ fecha: '2026-08-17', tipo: 'ingreso', monto: 100 })]
    const result = series(movimientos, 'semana', range, 1)
    expect(result).toHaveLength(7)
    expect(result[0]).toEqual({ bucketStart: '2026-08-17', ingresos: 100, gastos: 0 })
    expect(result[1]).toEqual({ bucketStart: '2026-08-18', ingresos: 0, gastos: 0 })
  })

  it('produces one bucket for a dia period', () => {
    const range = periodRange('dia', '2026-08-19', 1)
    const result = series([], 'dia', range, 1)
    expect(result).toEqual([{ bucketStart: '2026-08-19', ingresos: 0, gastos: 0 }])
  })

  it('produces 12 monthly buckets for an anio period', () => {
    const range = periodRange('anio', '2026-06-01', 1)
    const movimientos = [movimiento({ fecha: '2026-03-15', tipo: 'gasto', monto: 50 })]
    const result = series(movimientos, 'anio', range, 1)
    expect(result).toHaveLength(12)
    expect(result[2]).toEqual({ bucketStart: '2026-03-01', ingresos: 0, gastos: 50 })
  })

  it('produces weekly buckets for a mes period, respecting primerDiaSemana', () => {
    const range = periodRange('mes', '2026-08-01', 1)
    const result = series([], 'mes', range, 1)
    // August 2026: weeks starting Mon 2026-07-27 through the week containing Aug 31.
    expect(result.at(0)?.bucketStart).toBe('2026-07-27')
    expect(result.every((bucket) => bucket.ingresos === 0 && bucket.gastos === 0)).toBe(true)
  })
})
