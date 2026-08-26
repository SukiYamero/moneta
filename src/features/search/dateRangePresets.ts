import { endOfMonth, endOfYear, startOfMonth, startOfYear, subDays } from 'date-fns'
import { toIsoDate, type DateRange } from '@/lib/movimientoStats'

export type DateRangePreset = 'all' | '7d' | '30d' | 'month' | 'year' | 'custom'

export interface CustomRange {
  from: string
  to: string
}

const swapIfReversed = (custom: CustomRange): DateRange =>
  custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }

const RESOLVER_FOR_PRESET: Record<
  DateRangePreset,
  (today: Date, custom: CustomRange) => DateRange | null
> = {
  all: () => null,
  '7d': (today) => ({ from: toIsoDate(subDays(today, 6)), to: toIsoDate(today) }),
  '30d': (today) => ({ from: toIsoDate(subDays(today, 29)), to: toIsoDate(today) }),
  month: (today) => ({ from: toIsoDate(startOfMonth(today)), to: toIsoDate(endOfMonth(today)) }),
  year: (today) => ({ from: toIsoDate(startOfYear(today)), to: toIsoDate(endOfYear(today)) }),
  custom: (_today, custom) => swapIfReversed(custom),
}

export const resolveDateRange = (
  preset: DateRangePreset,
  custom: CustomRange,
  today: Date = new Date(),
): DateRange | null => RESOLVER_FOR_PRESET[preset](today, custom)
