import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays } from 'date-fns'
import type { DateRange } from '@/lib/movimientoStats'

export type DateRangePreset = 'all' | '7d' | '30d' | 'month' | 'year' | 'custom'

export interface CustomRange {
  from: string
  to: string
}

const ISO_DATE_FORMAT = 'yyyy-MM-dd'
const toIsoDate = (date: Date): string => format(date, ISO_DATE_FORMAT)

/**
 * Resolves a preset (plus the user's custom picks, always consulted so the
 * caller doesn't need a separate branch) to the `DateRange` `filterByRange`
 * (`src/lib/movimientoStats.ts`) expects, or `null` for "no date filter at
 * all" — `all` is a distinct concept from "filter to this exact day", so it
 * doesn't get a sentinel range.
 *
 * A custom range where `from` lands after `to` (the user picked the second
 * tap before the first) is swapped rather than rejected — always resolving
 * to *some* valid range keeps the "Ver N resultados" count in the filter
 * sheet live no matter the tap order.
 */
export const resolveDateRange = (
  preset: DateRangePreset,
  custom: CustomRange,
  today: Date = new Date(),
): DateRange | null => {
  if (preset === 'all') return null
  if (preset === '7d') return { from: toIsoDate(subDays(today, 6)), to: toIsoDate(today) }
  if (preset === '30d') return { from: toIsoDate(subDays(today, 29)), to: toIsoDate(today) }
  if (preset === 'month') {
    return { from: toIsoDate(startOfMonth(today)), to: toIsoDate(endOfMonth(today)) }
  }
  if (preset === 'year') {
    return { from: toIsoDate(startOfYear(today)), to: toIsoDate(endOfYear(today)) }
  }
  return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
}
