// Pure presentation helpers for the Home dashboard — date/label formatting
// and the week-strip's day scaffold. None of these compute money; every
// figure on screen still traces to `movimientoStats` (see useHomeDashboard.ts).
import { addDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Movimiento } from '@/lib/schema'
import type { DateRange } from '@/lib/movimientoStats'

export type GreetingKey = 'morning' | 'afternoon' | 'evening'

/** Buenos días / Buenas tardes / Buenas noches, from the local hour. */
export const getGreetingKey = (date: Date): GreetingKey => {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 19) return 'afternoon'
  return 'evening'
}

/** First letter of the first and last name, e.g. "Alex Rivera" -> "AR". */
export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** 3-letter uppercase weekday abbreviation ("LUN"), matching the design's week strip. */
export const shortDayLabel = (iso: string): string =>
  format(parseISO(iso), 'EEE', { locale: es }).toUpperCase()

/** Single-letter uppercase weekday label ("L"), for the narrow chart labels. */
export const narrowDayLabel = (iso: string): string =>
  format(parseISO(iso), 'EEEEE', { locale: es }).toUpperCase()

/** "Junio 2026", capitalized — date-fns' `MMMM` is lowercase in `es`. */
export const monthYearLabel = (date: Date): string => {
  const label = format(date, 'MMMM yyyy', { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export interface WeekStripDay {
  iso: string
  dayLabel: string
  dayNumber: number
  isToday: boolean
  hasMovimientos: boolean
}

const WEEK_LENGTH = 7

/**
 * One entry per day of `weekRange` (both bounds inclusive, per
 * `periodRange`), flagging today and which days have at least one
 * movement — display-only, not an aggregation (see movimientoStats.ts for
 * the actual totals).
 */
export const buildWeekStripDays = (
  movimientos: Movimiento[],
  weekRange: DateRange,
  todayIso: string,
): WeekStripDay[] => {
  const datesWithMovimientos = new Set(movimientos.map((m) => m.fecha))
  const start = parseISO(weekRange.from)
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = addDays(start, i)
    const iso = format(date, 'yyyy-MM-dd')
    return {
      iso,
      dayLabel: shortDayLabel(iso),
      dayNumber: date.getDate(),
      isToday: iso === todayIso,
      hasMovimientos: datesWithMovimientos.has(iso),
    }
  })
}
