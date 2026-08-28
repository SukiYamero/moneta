import { describe, expect, it } from 'vitest'
import { enUS, es } from 'date-fns/locale'
import type { Movimiento } from '@/lib/schema'
import {
  buildWeekStripDays,
  getGreetingKey,
  monthYearLabel,
  narrowDayLabel,
  shortDayLabel,
} from '@/features/home/homeView'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-17',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-17T00:00:00.000Z',
  ...overrides,
})

describe('getGreetingKey', () => {
  it.each([
    [6, 'morning'],
    [14, 'afternoon'],
    [22, 'evening'],
    [2, 'evening'],
  ] as const)('hour %i maps to %s', (hour, expected) => {
    expect(getGreetingKey(new Date(2026, 7, 19, hour))).toBe(expected)
  })
})

describe('shortDayLabel / narrowDayLabel', () => {
  it('formats a known Monday as LUN / L', () => {
    expect(shortDayLabel('2026-08-17', es)).toBe('LUN')
    expect(narrowDayLabel('2026-08-17', es)).toBe('L')
  })

  it('renders in the locale passed by the caller', () => {
    expect(shortDayLabel('2026-08-17', enUS)).toBe('MON')
    expect(narrowDayLabel('2026-08-17', enUS)).toBe('M')
  })
})

describe('monthYearLabel', () => {
  it('capitalizes the month name', () => {
    expect(monthYearLabel(new Date(2026, 5, 25), es)).toBe('Junio 2026')
  })

  it('renders in the locale passed by the caller', () => {
    expect(monthYearLabel(new Date(2026, 5, 25), enUS)).toBe('June 2026')
  })
})

describe('buildWeekStripDays', () => {
  const weekRange = { from: '2026-08-17', to: '2026-08-23' }

  it('returns exactly 7 days spanning the range', () => {
    const days = buildWeekStripDays([], weekRange, '2026-08-17', es)
    expect(days).toHaveLength(7)
    expect(days[0]?.iso).toBe('2026-08-17')
    expect(days.at(-1)?.iso).toBe('2026-08-23')
  })

  it('flags exactly one day as today', () => {
    const days = buildWeekStripDays([], weekRange, '2026-08-19', es)
    expect(days.filter((d) => d.isToday)).toHaveLength(1)
    expect(days.find((d) => d.isToday)?.iso).toBe('2026-08-19')
  })

  it('flags a day as having movements only when one falls exactly on it', () => {
    const days = buildWeekStripDays(
      [movimiento({ fecha: '2026-08-18' })],
      weekRange,
      '2026-08-17',
      es,
    )
    expect(days.find((d) => d.iso === '2026-08-18')?.hasMovimientos).toBe(true)
    expect(days.find((d) => d.iso === '2026-08-19')?.hasMovimientos).toBe(false)
  })

  it('renders day labels in the locale passed by the caller', () => {
    const days = buildWeekStripDays([], weekRange, '2026-08-17', enUS)
    expect(days[0]?.dayLabel).toBe('MON')
  })
})
