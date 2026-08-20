import { endOfMonth, endOfYear, startOfMonth, startOfYear, subDays } from 'date-fns'
import { toIsoDate, type DateRange } from '@/lib/movimientoStats'

export type DateRangePreset = 'all' | '7d' | '30d' | 'month' | 'year' | 'custom'

export interface CustomRange {
  from: string
  to: string
}

const swapIfReversed = (custom: CustomRange): DateRange =>
  custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }

// Preset → resolver, mirroring `RANGE_FOR_PERIODO` in `src/lib/movimientoStats.ts`
// (same shape: an enum dispatching to a per-key computation over extra
// args, looked up rather than branched — AGENTS.md's value→value mapping
// rule).
const RESOLVER_FOR_PRESET: Record<
  DateRangePreset,
  (today: Date, custom: CustomRange) => DateRange | null
> = {
  all: () => null,
  '7d': (today) => ({ from: toIsoDate(subDays(today, 6)), to: toIsoDate(today) }),
  '30d': (today) => ({ from: toIsoDate(subDays(today, 29)), to: toIsoDate(today) }),
  month: (today) => ({ from: toIsoDate(startOfMonth(today)), to: toIsoDate(endOfMonth(today)) }),
  year: (today) => ({ from: toIsoDate(startOfYear(today)), to: toIsoDate(endOfYear(today)) }),
  // A custom range where `from` lands after `to` (the user picked the
  // second tap before the first) is swapped rather than rejected — always
  // resolving to *some* valid range keeps the "Ver N resultados" count in
  // the filter sheet live no matter the tap order.
  custom: (_today, custom) => swapIfReversed(custom),
}

/**
 * Resolves a preset (plus the user's custom picks, always consulted so the
 * caller doesn't need a separate branch) to the `DateRange` `filterByRange`
 * (`src/lib/movimientoStats.ts`) expects, or `null` for "no date filter at
 * all" — `all` is a distinct concept from "filter to this exact day", so it
 * doesn't get a sentinel range.
 */
export const resolveDateRange = (
  preset: DateRangePreset,
  custom: CustomRange,
  today: Date = new Date(),
): DateRange | null => RESOLVER_FOR_PRESET[preset](today, custom)
