import { addDays, format, parseISO, type Locale } from 'date-fns'
import type { Movimiento } from '@/lib/schema'
import { toIsoDate, type DateRange } from '@/lib/movimientoStats'

export type GreetingKey = 'morning' | 'afternoon' | 'evening'

export const getGreetingKey = (date: Date): GreetingKey => {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 19) return 'afternoon'
  return 'evening'
}

export const shortDayLabel = (iso: string, locale: Locale): string =>
  format(parseISO(iso), 'EEE', { locale }).toUpperCase()

export const narrowDayLabel = (iso: string, locale: Locale): string =>
  format(parseISO(iso), 'EEEEE', { locale }).toUpperCase()

// date-fns's MMMM format token is lowercase in most locales.
export const monthYearLabel = (date: Date, locale: Locale): string => {
  const label = format(date, 'MMMM yyyy', { locale })
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

export const buildWeekStripDays = (
  movimientos: Movimiento[],
  weekRange: DateRange,
  todayIso: string,
  locale: Locale,
): WeekStripDay[] => {
  const datesWithMovimientos = new Set(movimientos.map((m) => m.fecha))
  const start = parseISO(weekRange.from)
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = addDays(start, i)
    const iso = toIsoDate(date)
    return {
      iso,
      dayLabel: shortDayLabel(iso, locale),
      dayNumber: date.getDate(),
      isToday: iso === todayIso,
      hasMovimientos: datesWithMovimientos.has(iso),
    }
  })
}
