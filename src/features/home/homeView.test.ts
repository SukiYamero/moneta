import { describe, expect, it } from 'vitest'
import type { Movimiento } from '@/lib/schema'
import {
  buildWeekStripDays,
  getGreetingKey,
  getInitials,
  monthYearLabel,
  narrowDayLabel,
  shortDayLabel,
} from '@/features/home/homeView'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-17',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-17T00:00:00.000Z',
  ...overrides,
})

describe('getGreetingKey', () => {
  it('returns morning for early hours', () => {
    expect(getGreetingKey(new Date(2026, 7, 19, 6))).toBe('morning')
  })

  it('returns afternoon for midday hours', () => {
    expect(getGreetingKey(new Date(2026, 7, 19, 14))).toBe('afternoon')
  })

  it('returns evening for night hours', () => {
    expect(getGreetingKey(new Date(2026, 7, 19, 22))).toBe('evening')
  })

  it('returns evening for the early-morning boundary before 5am', () => {
    expect(getGreetingKey(new Date(2026, 7, 19, 2))).toBe('evening')
  })
})

describe('getInitials', () => {
  it('takes the first letter of the first and last name', () => {
    expect(getInitials('Alex Rivera')).toBe('AR')
  })

  it('handles a single name', () => {
    expect(getInitials('Alex')).toBe('A')
  })

  it('ignores extra whitespace', () => {
    expect(getInitials('  Alex   Rivera  ')).toBe('AR')
  })

  it('returns an empty string for an empty name', () => {
    expect(getInitials('')).toBe('')
  })
})

describe('shortDayLabel / narrowDayLabel', () => {
  it('formats a known Monday as LUN / L', () => {
    // 2026-08-17 is a Monday.
    expect(shortDayLabel('2026-08-17')).toBe('LUN')
    expect(narrowDayLabel('2026-08-17')).toBe('L')
  })
})

describe('monthYearLabel', () => {
  it('capitalizes the month name', () => {
    expect(monthYearLabel(new Date(2026, 5, 25))).toBe('Junio 2026')
  })
})

describe('buildWeekStripDays', () => {
  const weekRange = { from: '2026-08-17', to: '2026-08-23' }

  it('returns exactly 7 days spanning the range', () => {
    const days = buildWeekStripDays([], weekRange, '2026-08-17')
    expect(days).toHaveLength(7)
    expect(days[0]?.iso).toBe('2026-08-17')
    expect(days.at(-1)?.iso).toBe('2026-08-23')
  })

  it('flags exactly one day as today', () => {
    const days = buildWeekStripDays([], weekRange, '2026-08-19')
    expect(days.filter((d) => d.isToday)).toHaveLength(1)
    expect(days.find((d) => d.isToday)?.iso).toBe('2026-08-19')
  })

  it('flags a day as having movements only when one falls exactly on it', () => {
    const days = buildWeekStripDays([movimiento({ fecha: '2026-08-18' })], weekRange, '2026-08-17')
    expect(days.find((d) => d.iso === '2026-08-18')?.hasMovimientos).toBe(true)
    expect(days.find((d) => d.iso === '2026-08-19')?.hasMovimientos).toBe(false)
  })
})
