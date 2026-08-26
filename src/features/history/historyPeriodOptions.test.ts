import { describe, expect, it } from 'vitest'
import { enUS, es } from 'date-fns/locale'
import type { Movimiento } from '@/lib/schema'
import { periodRange } from '@/lib/movimientoStats'
import {
  buildDayOptions,
  buildMonthOptions,
  buildWeekOptions,
  buildYearOptions,
} from '@/features/history/historyPeriodOptions'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'Comida',
  tipo: 'gasto',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

describe('buildYearOptions', () => {
  it('includes every year present in the data plus the current year, newest first, deduped', () => {
    const movimientos = [
      movimiento({ fecha: '2024-01-01' }),
      movimiento({ fecha: '2025-06-01' }),
      movimiento({ fecha: '2025-12-01' }),
    ]
    expect(buildYearOptions(movimientos, new Date('2026-08-19'))).toEqual([2026, 2025, 2024])
  })

  it('is never empty, even with no movements', () => {
    expect(buildYearOptions([], new Date('2026-08-19'))).toEqual([2026])
  })
})

describe('buildDayOptions', () => {
  it('covers every day of the anchor month, marks the selected one and flags days with data', () => {
    const movimientos = [movimiento({ fecha: '2026-08-15' })]
    const anchor = '2026-08-19'
    const range = periodRange('dia', anchor, 1)
    const options = buildDayOptions(movimientos, anchor, range, es)

    expect(options).toHaveLength(31)
    expect(options.find((o) => o.iso === '2026-08-19')?.selected).toBe(true)
    expect(options.find((o) => o.iso === '2026-08-15')?.hasData).toBe(true)
    expect(options.find((o) => o.iso === '2026-08-16')?.hasData).toBe(false)
  })

  it('renders the weekday caption in the locale passed by the caller', () => {
    const movimientos = [movimiento({ fecha: '2026-08-15' })]
    const anchor = '2026-08-19'
    const range = periodRange('dia', anchor, 1)
    const esOption = buildDayOptions(movimientos, anchor, range, es).find(
      (o) => o.iso === '2026-08-17',
    )
    const enOption = buildDayOptions(movimientos, anchor, range, enUS).find(
      (o) => o.iso === '2026-08-17',
    )
    expect(esOption?.caption).toBe('l')
    expect(enOption?.caption).toBe('M')
  })
})

describe('buildWeekOptions', () => {
  it('produces weeks whose own periodRange bounds contain the current range for both primerDiaSemana settings', () => {
    const movimientos = [movimiento({ fecha: '2026-08-15' })]
    const anchor = '2026-08-19'

    for (const primerDiaSemana of [0, 1] as const) {
      const range = periodRange('semana', anchor, primerDiaSemana)
      const options = buildWeekOptions(movimientos, anchor, range, primerDiaSemana, es)
      const selected = options.find((o) => o.selected)
      expect(selected?.iso).toBe(range.from)
      for (const option of options) {
        expect(periodRange('semana', option.iso, primerDiaSemana).from).toBe(option.iso)
      }
    }
  })
})

describe('buildMonthOptions', () => {
  it('covers all 12 months of the anchor year and flags months with data', () => {
    const movimientos = [movimiento({ fecha: '2026-08-15' }), movimiento({ fecha: '2026-01-05' })]
    const anchor = '2026-08-19'
    const range = periodRange('mes', anchor, 1)
    const options = buildMonthOptions(movimientos, anchor, range, 1, es)

    expect(options).toHaveLength(12)
    expect(options.find((o) => o.selected)?.iso).toBe('2026-08-01')
    expect(options.find((o) => o.iso === '2026-01-01')?.hasData).toBe(true)
    expect(options.find((o) => o.iso === '2026-02-01')?.hasData).toBe(false)
  })

  it('renders the month label in the locale passed by the caller', () => {
    const movimientos = [movimiento({ fecha: '2026-08-15' })]
    const anchor = '2026-08-19'
    const range = periodRange('mes', anchor, 1)
    const options = buildMonthOptions(movimientos, anchor, range, 1, enUS)
    expect(options.find((o) => o.iso === '2026-08-01')?.label).toBe('Aug')
  })
})
