import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getYear,
  parseISO,
  startOfMonth,
  startOfYear,
  type Locale,
} from 'date-fns'
import type { Movimiento, Periodo } from '@/lib/schema'
import { type DateRange, filterByRange, periodRange } from '@/lib/movimientoStats'

export interface PeriodOption {
  /** ISO `yyyy-mm-dd` — any date that resolves back to this option's own period via `periodRange`. */
  iso: string
  label: string
  caption?: string
  hasData: boolean
  selected: boolean
}

const ISO_DATE_FORMAT = 'yyyy-MM-dd'
const toIsoDate = (date: Date): string => format(date, ISO_DATE_FORMAT)

const hasMovements = (movimientos: Movimiento[], range: DateRange): boolean =>
  filterByRange(movimientos, range).length > 0

/** Years present in the data, plus the current year so the menu is never empty, newest first. */
export const buildYearOptions = (movimientos: Movimiento[], today: Date): number[] => {
  const years = new Set(movimientos.map((m) => Number(m.fecha.slice(0, 4))))
  years.add(getYear(today))
  return [...years].toSorted((a, b) => b - a)
}

/** Every day of `anchor`'s month, for the `dia` scope's picker strip. */
export const buildDayOptions = (
  movimientos: Movimiento[],
  anchor: string,
  currentRange: DateRange,
  locale: Locale,
): PeriodOption[] => {
  const monthStart = startOfMonth(parseISO(anchor))
  return eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) }).map((date) => {
    const iso = toIsoDate(date)
    return {
      iso,
      label: format(date, 'd'),
      caption: format(date, 'EEEEE', { locale }),
      hasData: hasMovements(movimientos, { from: iso, to: iso }),
      selected: iso === currentRange.from && currentRange.to === currentRange.from,
    }
  })
}

/**
 * Every calendar week overlapping `anchor`'s month (honouring
 * `primerDiaSemana`), for the `semana` scope's picker strip. Each option's
 * own bounds come from `periodRange`, never hand-rolled, so a picker chip
 * can never disagree with the range it jumps to.
 */
export const buildWeekOptions = (
  movimientos: Movimiento[],
  anchor: string,
  currentRange: DateRange,
  primerDiaSemana: 0 | 1,
  locale: Locale,
): PeriodOption[] => {
  const monthStart = startOfMonth(parseISO(anchor))
  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: endOfMonth(monthStart) },
    { weekStartsOn: primerDiaSemana },
  )
  return weekStarts.map((weekStart) => {
    const weekRange = periodRange('semana', toIsoDate(weekStart), primerDiaSemana)
    return {
      iso: weekRange.from,
      label: `${format(parseISO(weekRange.from), 'd')}–${format(parseISO(weekRange.to), 'd MMM', { locale })}`,
      hasData: hasMovements(movimientos, weekRange),
      selected: weekRange.from === currentRange.from,
    }
  })
}

/** Every month of `anchor`'s year, for the `mes` scope's picker strip. */
export const buildMonthOptions = (
  movimientos: Movimiento[],
  anchor: string,
  currentRange: DateRange,
  primerDiaSemana: 0 | 1,
  locale: Locale,
): PeriodOption[] => {
  const yearStart = startOfYear(parseISO(anchor))
  return eachMonthOfInterval({ start: yearStart, end: endOfYear(yearStart) }).map((date) => {
    const monthRange = periodRange('mes', toIsoDate(date), primerDiaSemana)
    return {
      iso: monthRange.from,
      label: format(date, 'LLL', { locale }),
      hasData: hasMovements(movimientos, monthRange),
      selected: monthRange.from === currentRange.from,
    }
  })
}

export const PICKER_FOR_SCOPE: Record<Periodo, 'day' | 'week' | 'month' | 'none'> = {
  dia: 'day',
  semana: 'week',
  mes: 'month',
  anio: 'none',
}
