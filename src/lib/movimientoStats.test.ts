import { addDays, format, parseISO, subDays } from 'date-fns'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Movimiento, Periodo } from '@/lib/schema'
import {
  breakdownBy,
  filterByRange,
  otherCurrencies,
  periodRange,
  series,
  totals,
} from '@/lib/movimientoStats'

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

const dayBefore = (iso: string): string => format(subDays(parseISO(iso), 1), 'yyyy-MM-dd')
const dayAfter = (iso: string): string => format(addDays(parseISO(iso), 1), 'yyyy-MM-dd')

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('totals()', () => {
  // IEEE-754: `0.1 + 0.2` is 0.30000000000000004, not 0.3.
  it('sums 0.1 and 0.2 ingresos to exactly 0.3, not the float-drift result', () => {
    const movimientos = [
      movimiento({ tipo: 'ingreso', monto: 0.1 }),
      movimiento({ tipo: 'ingreso', monto: 0.2 }),
    ]
    expect(totals(movimientos, 'COP').ingresos).toBe(0.3)
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('sums a realistic COP set without drift', () => {
    const movimientos = [
      movimiento({ tipo: 'gasto', monto: 333_333.33 }),
      movimiento({ tipo: 'gasto', monto: 666_666.67 }),
    ]
    expect(totals(movimientos, 'COP').gastos).toBe(1_000_000)
  })

  it('computes balance as ingresos minus gastos', () => {
    const movimientos = [
      movimiento({ tipo: 'ingreso', monto: 500 }),
      movimiento({ tipo: 'gasto', monto: 200 }),
    ]
    expect(totals(movimientos, 'COP')).toEqual({ ingresos: 500, gastos: 200, balance: 300 })
  })

  it('returns all zeros for an empty list', () => {
    expect(totals([], 'COP')).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
  })

  it('handles an all-expense set (ingresos stays 0)', () => {
    const movimientos = [movimiento({ tipo: 'gasto', monto: 100 })]
    expect(totals(movimientos, 'COP')).toEqual({ ingresos: 0, gastos: 100, balance: -100 })
  })

  describe('currency scoping', () => {
    it('sums only movements matching the given moneda, ignoring the rest', () => {
      const movimientos = [
        movimiento({ tipo: 'ingreso', monto: 500, moneda: 'COP' }),
        movimiento({ tipo: 'ingreso', monto: 300, moneda: 'USD' }),
        movimiento({ tipo: 'gasto', monto: 100, moneda: 'COP' }),
        movimiento({ tipo: 'gasto', monto: 50, moneda: 'USD' }),
      ]
      expect(totals(movimientos, 'COP')).toEqual({ ingresos: 500, gastos: 100, balance: 400 })
      expect(totals(movimientos, 'USD')).toEqual({ ingresos: 300, gastos: 50, balance: 250 })
    })

    it('returns all zeros for a currency with no movements, even when other currencies have plenty', () => {
      const movimientos = [
        movimiento({ tipo: 'ingreso', monto: 500, moneda: 'COP' }),
        movimiento({ tipo: 'gasto', monto: 200, moneda: 'COP' }),
      ]
      expect(totals(movimientos, 'USD')).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
    })
  })
})

describe('periodRange() — timezone safety', () => {
  // `new Date('2026-09-01')` parses as UTC midnight, which is Aug 31 local under a negative-offset TZ.
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
  it('groups by categoria, sorted by total desc, shares summing to 1', () => {
    const movimientos = [
      movimiento({ categoria: 'cat_sueldo', tipo: 'gasto', monto: 100 }),
      movimiento({ categoria: 'cat_sueldo', tipo: 'gasto', monto: 200 }),
      movimiento({ categoria: 'cat_ventas', tipo: 'gasto', monto: 100 }),
    ]
    const result = breakdownBy(movimientos, 'gasto', 'COP')
    expect(result).toEqual([
      { key: 'cat_sueldo', total: 300, share: 0.75 },
      { key: 'cat_ventas', total: 100, share: 0.25 },
    ])
  })

  it('filters by tipo before grouping', () => {
    const movimientos = [
      movimiento({ categoria: 'cat_sueldo', tipo: 'ingreso', monto: 500 }),
      movimiento({ categoria: 'cat_sueldo', tipo: 'gasto', monto: 100 }),
    ]
    const result = breakdownBy(movimientos, 'gasto', 'COP')
    expect(result).toEqual([{ key: 'cat_sueldo', total: 100, share: 1 }])
  })

  it('returns an empty array with no NaN shares when the total is zero', () => {
    expect(breakdownBy([], 'gasto', 'COP')).toEqual([])
  })

  it('only groups movements matching the given moneda', () => {
    const movimientos = [
      movimiento({ categoria: 'cat_sueldo', tipo: 'gasto', monto: 100, moneda: 'COP' }),
      movimiento({ categoria: 'cat_ventas', tipo: 'gasto', monto: 900, moneda: 'USD' }),
    ]
    const result = breakdownBy(movimientos, 'gasto', 'COP')
    expect(result).toEqual([{ key: 'cat_sueldo', total: 100, share: 1 }])
  })
})

describe('series()', () => {
  it('produces one bucket per day for a semana period, including empty days', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const range = periodRange('semana', '2026-08-19', 1)
    const movimientos = [movimiento({ fecha: '2026-08-17', tipo: 'ingreso', monto: 100 })]
    const result = series(movimientos, 'semana', range, 1, 'COP')
    expect(result).toHaveLength(7)
    expect(result[0]).toEqual({ bucketStart: '2026-08-17', ingresos: 100, gastos: 0 })
    expect(result[1]).toEqual({ bucketStart: '2026-08-18', ingresos: 0, gastos: 0 })
  })

  it('produces one bucket for a dia period', () => {
    const range = periodRange('dia', '2026-08-19', 1)
    const result = series([], 'dia', range, 1, 'COP')
    expect(result).toEqual([{ bucketStart: '2026-08-19', ingresos: 0, gastos: 0 }])
  })

  it('produces 12 monthly buckets for an anio period', () => {
    const range = periodRange('anio', '2026-06-01', 1)
    const movimientos = [movimiento({ fecha: '2026-03-15', tipo: 'gasto', monto: 50 })]
    const result = series(movimientos, 'anio', range, 1, 'COP')
    expect(result).toHaveLength(12)
    expect(result[2]).toEqual({ bucketStart: '2026-03-01', ingresos: 0, gastos: 50 })
  })

  it('produces weekly buckets for a mes period, clamped to the month (not the natural week)', () => {
    const range = periodRange('mes', '2026-08-01', 1)
    const result = series([], 'mes', range, 1, 'COP')
    expect(result.at(0)?.bucketStart).toBe('2026-08-01')
    expect(result.every((bucket) => bucket.ingresos === 0 && bucket.gastos === 0)).toBe(true)
  })

  it('only counts movements matching the given moneda in each bucket', () => {
    vi.stubEnv('TZ', 'America/Bogota')
    const range = periodRange('semana', '2026-08-19', 1)
    const movimientos = [
      movimiento({ fecha: '2026-08-17', tipo: 'ingreso', monto: 100, moneda: 'COP' }),
      movimiento({ fecha: '2026-08-17', tipo: 'ingreso', monto: 999, moneda: 'USD' }),
    ]
    const result = series(movimientos, 'semana', range, 1, 'COP')
    expect(result[0]).toEqual({ bucketStart: '2026-08-17', ingresos: 100, gastos: 0 })
  })

  // date-fns's eachWeekOfInterval/eachMonthOfInterval grid-snap to natural boundaries, which can pull in movements from outside `range`.
  describe('bucket-range invariant: sum(series) === totals(filterByRange)', () => {
    const periods: Periodo[] = ['dia', 'semana', 'mes', 'anio']
    const primerDiaSemanaValues: (0 | 1)[] = [0, 1]
    const cases = periods.flatMap((periodo) =>
      primerDiaSemanaValues.map((primerDiaSemana) => [periodo, primerDiaSemana] as const),
    )

    it.each(cases)(
      'holds for periodo=%s, primerDiaSemana=%s even with movements just outside the range',
      (periodo, primerDiaSemana) => {
        const range = periodRange(periodo, '2026-08-19', primerDiaSemana)
        const movimientos = [
          movimiento({ id: 'before', fecha: dayBefore(range.from), tipo: 'ingreso', monto: 111 }),
          movimiento({ id: 'at-from', fecha: range.from, tipo: 'gasto', monto: 222 }),
          movimiento({ id: 'at-to', fecha: range.to, tipo: 'ingreso', monto: 333 }),
          movimiento({ id: 'after', fecha: dayAfter(range.to), tipo: 'gasto', monto: 444 }),
        ]

        const result = series(movimientos, periodo, range, primerDiaSemana, 'COP')
        const seriesIngresos = result.reduce((sum, b) => sum + b.ingresos, 0)
        const seriesGastos = result.reduce((sum, b) => sum + b.gastos, 0)
        const expected = totals(filterByRange(movimientos, range), 'COP')

        expect(seriesIngresos).toBe(expected.ingresos)
        expect(seriesGastos).toBe(expected.gastos)
        expect((result.at(0)?.bucketStart ?? '') >= range.from).toBe(true)
      },
    )

    // IEEE-754: `0.01 + 0.05` is 0.060000000000000005, not 0.06.
    it('holds to the cent (not necessarily bit-exact) with multiple same-tipo fractional buckets', () => {
      const primerDiaSemana = 1
      const range = periodRange('semana', '2026-08-19', primerDiaSemana)
      const movimientos = [
        movimiento({ fecha: '2026-08-17', tipo: 'ingreso', monto: 0.01 }),
        movimiento({ fecha: '2026-08-18', tipo: 'ingreso', monto: 0.05 }),
      ]
      const result = series(movimientos, 'semana', range, primerDiaSemana, 'COP')
      const seriesIngresos = result.reduce((sum, b) => sum + b.ingresos, 0)
      const expected = totals(filterByRange(movimientos, range), 'COP')
      expect(seriesIngresos).toBeCloseTo(expected.ingresos, 2)
    })
  })
})

describe('otherCurrencies()', () => {
  it('returns an empty array when every movement matches the principal currency', () => {
    const movimientos = [movimiento({ moneda: 'COP' }), movimiento({ moneda: 'COP' })]
    expect(otherCurrencies(movimientos, 'COP')).toEqual([])
  })

  it('returns the distinct currencies other than the principal one, in first-seen order', () => {
    const movimientos = [
      movimiento({ moneda: 'COP' }),
      movimiento({ moneda: 'USD' }),
      movimiento({ moneda: 'MXN' }),
      movimiento({ moneda: 'USD' }),
    ]
    expect(otherCurrencies(movimientos, 'COP')).toEqual(['USD', 'MXN'])
  })

  it('returns an empty array for an empty list', () => {
    expect(otherCurrencies([], 'COP')).toEqual([])
  })
})
