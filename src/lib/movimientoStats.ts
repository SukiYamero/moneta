// Pure derivation of every number the Home/History/Search screens show, from
// `Movimiento[]` (specs.md §4: views are derived, never stored). No imports
// from stores/UI/repo — keeps this trivially testable and reusable by all
// three screens, so their numbers cannot disagree.
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import type { Interval } from 'date-fns'
import type { Moneda, Movimiento, Periodo } from '@/lib/schema'

export interface DateRange {
  from: string
  to: string
}

export interface Totals {
  ingresos: number
  gastos: number
  balance: number
}

export interface BreakdownEntry {
  key: string
  total: number
  share: number
}

export interface SeriesBucket {
  bucketStart: string
  ingresos: number
  gastos: number
}

const ISO_DATE_FORMAT = 'yyyy-MM-dd'

// `fecha` is a date-only ISO string with no time-of-day component, so it must
// be parsed as local, not UTC, midnight — `new Date('2026-09-01')` parses as
// UTC midnight, which is Aug 31 local under any negative-offset TZ (every
// user this app targets, per AGENTS.md/specs.md §11). `parseISO` parses a
// date-only string as local midnight instead.
const toLocalDate = (iso: string): Date => parseISO(iso)

// Exported so callers that build their own date-only ISO strings (History's
// period pickers, Search's date-range presets, Home's "today") share one
// formatting rule instead of each redeclaring `format(date, 'yyyy-MM-dd')`
// (specs.md §12, 2026-08-20).
export const toIsoDate = (date: Date): string => format(date, ISO_DATE_FORMAT)

const RANGE_FOR_PERIODO: Record<
  Periodo,
  (anchor: Date, primerDiaSemana: 0 | 1) => { start: Date; end: Date }
> = {
  dia: (anchor) => ({ start: anchor, end: anchor }),
  semana: (anchor, primerDiaSemana) => ({
    start: startOfWeek(anchor, { weekStartsOn: primerDiaSemana }),
    end: endOfWeek(anchor, { weekStartsOn: primerDiaSemana }),
  }),
  mes: (anchor) => ({ start: startOfMonth(anchor), end: endOfMonth(anchor) }),
  anio: (anchor) => ({ start: startOfYear(anchor), end: endOfYear(anchor) }),
}

/** Inclusive ISO `yyyy-mm-dd` bounds of the period containing `anchor`. */
export const periodRange = (
  periodo: Periodo,
  anchor: string,
  primerDiaSemana: 0 | 1,
): DateRange => {
  const { start, end } = RANGE_FOR_PERIODO[periodo](toLocalDate(anchor), primerDiaSemana)
  return { from: toIsoDate(start), to: toIsoDate(end) }
}

/**
 * Movements within `range`, both bounds inclusive. Compared as ISO strings
 * (never parsed to `Date`) — lexicographic order on `yyyy-mm-dd` is
 * chronological order, so this is immune to the UTC-midnight shift entirely.
 */
export const filterByRange = (movimientos: Movimiento[], range: DateRange): Movimiento[] =>
  movimientos.filter((m) => m.fecha >= range.from && m.fecha <= range.to)

const MINOR_UNITS_PER_MONTO = 100

// `monto` is a JS `number`; summing it directly drifts (0.1 + 0.2 !==
// 0.3). Accumulate in integer minor units (cents) and divide once on the
// way out — the non-negotiable money rule (AGENTS.md, docs/wave-2-plan.md §3.4).
const toMinorUnits = (monto: number): number => Math.round(monto * MINOR_UNITS_PER_MONTO)
const fromMinorUnits = (minor: number): number => minor / MINOR_UNITS_PER_MONTO

const sumMinorUnits = (movimientos: Movimiento[]): number =>
  movimientos.reduce((sum, m) => sum + toMinorUnits(m.monto), 0)

/**
 * `{ ingresos, gastos, balance }`, all in normal units, summed without float
 * drift, scoped to movements in `moneda`.
 *
 * `moneda` is required, not defaulted (specs.md §10.27, user decision
 * 2026-08-20): a total is never the sum of two different currencies. Every
 * movement carried the same currency while `monedaPrincipal` was a
 * device-region default decided once; it stopped being true the moment
 * `monedaPrincipal` became user-editable, and a default parameter here
 * would silently reproduce the exact bug it fixes at any call site that
 * forgets to pass one.
 */
export const totals = (movimientos: Movimiento[], moneda: Moneda): Totals => {
  const enMoneda = movimientos.filter((m) => m.moneda === moneda)
  const ingresosMinor = sumMinorUnits(enMoneda.filter((m) => m.tipo === 'ingreso'))
  const gastosMinor = sumMinorUnits(enMoneda.filter((m) => m.tipo === 'gasto'))
  return {
    ingresos: fromMinorUnits(ingresosMinor),
    gastos: fromMinorUnits(gastosMinor),
    balance: fromMinorUnits(ingresosMinor - gastosMinor),
  }
}

/**
 * Distinct currencies present in `movimientos` other than `moneda`, in
 * first-seen order — empty when every movement already matches `moneda`
 * (the overwhelmingly common case). This is what lets a screen say, out
 * loud, that a total excludes movements rather than silently dropping them
 * (specs.md §10.27) — never used to include them in a sum.
 */
export const otherCurrencies = (movimientos: Movimiento[], moneda: Moneda): Moneda[] => {
  const seen = new Set<Moneda>()
  for (const m of movimientos) {
    if (m.moneda !== moneda) seen.add(m.moneda)
  }
  return [...seen]
}

/**
 * Totals grouped by `seccion` or `categoria`, pre-filtered by `tipo`, sorted
 * by total desc. `share` is each group's fraction of the grand total
 * (summing to 1), or 0 for every entry when the grand total is 0 — never
 * `NaN`.
 *
 * `tipo` is required, not optional: mixing ingresos and gastos into one
 * grand total makes `share` a fraction of "income plus spending," a
 * quantity no screen can present meaningfully. Call it once per tipo if a
 * combined view is ever needed — that's an explicit choice at the call
 * site, not a silent default here.
 *
 * `moneda` is required for the same reason `totals()` requires it (specs.md
 * §10.27): a category's share of a mixed-currency sum is meaningless.
 */
export const breakdownBy = (
  movimientos: Movimiento[],
  groupKey: 'seccion' | 'categoria',
  tipo: Movimiento['tipo'],
  moneda: Moneda,
): BreakdownEntry[] => {
  const filtered = movimientos.filter((m) => m.tipo === tipo && m.moneda === moneda)
  const minorByKey = new Map<string, number>()
  for (const m of filtered) {
    const key = m[groupKey]
    minorByKey.set(key, (minorByKey.get(key) ?? 0) + toMinorUnits(m.monto))
  }
  const grandTotalMinor = [...minorByKey.values()].reduce((sum, v) => sum + v, 0)
  return [...minorByKey.entries()]
    .map(([key, totalMinor]) => ({
      key,
      total: fromMinorUnits(totalMinor),
      share: grandTotalMinor === 0 ? 0 : totalMinor / grandTotalMinor,
    }))
    .toSorted((a, b) => b.total - a.total)
}

// A bucket's own calendar granularity per periodo — see docs/wave-2/track-e1.md
// "series() bucket granularity" for the reasoning (this is a judgment call the
// brief left open beyond the 'semana' → 7-daily-bars example).
type BucketGranularity = 'day' | 'week' | 'month'

const GRANULARITY_FOR_PERIODO: Record<Periodo, BucketGranularity> = {
  dia: 'day',
  semana: 'day',
  mes: 'week',
  anio: 'month',
}

// Value→value dispatch on granularity, as a Record rather than an if-chain —
// same pattern as RANGE_FOR_PERIODO above (AGENTS.md: lookup table, never
// switch/if-else, even when the branches' bodies take different shapes).
const BUCKET_STARTS_FOR: Record<
  BucketGranularity,
  (interval: Interval, primerDiaSemana: 0 | 1) => Date[]
> = {
  month: (interval) => eachMonthOfInterval(interval),
  week: (interval, primerDiaSemana) =>
    eachWeekOfInterval(interval, { weekStartsOn: primerDiaSemana }),
  day: (interval) => eachDayOfInterval(interval),
}

const bucketStartsFor = (
  granularity: BucketGranularity,
  range: DateRange,
  primerDiaSemana: 0 | 1,
): Date[] => {
  const interval = { start: toLocalDate(range.from), end: toLocalDate(range.to) }
  return BUCKET_STARTS_FOR[granularity](interval, primerDiaSemana)
}

const BUCKET_END_FOR: Record<BucketGranularity, (start: Date, primerDiaSemana: 0 | 1) => Date> = {
  month: (start) => endOfMonth(start),
  week: (start, primerDiaSemana) => endOfWeek(start, { weekStartsOn: primerDiaSemana }),
  day: (start) => start,
}

const bucketEndFor = (granularity: BucketGranularity, start: Date, primerDiaSemana: 0 | 1): Date =>
  BUCKET_END_FOR[granularity](start, primerDiaSemana)

/**
 * One bucket per sub-period covering `range`, including empty buckets (a
 * week with no movements still needs seven bars). Sub-period granularity is
 * a property of `periodo` (day/week/month bars for semana/mes/anio
 * respectively; a single bucket for dia), not of the chart consumer.
 *
 * `eachWeekOfInterval`/`eachMonthOfInterval` snap to their own calendar grid,
 * so the first/last natural sub-period can start before `range.from` or end
 * after `range.to` (e.g. August's first ISO week starts in late July). Every
 * bucket is clamped to `range` on both ends — both what it counts and its
 * `bucketStart` label — so `sum(series(...).ingresos) ===
 * totals(filterByRange(movimientos, range)).ingresos` holds to the cent (and
 * the same for `gastos`). This is the guarantee Home's chart bars and Home's
 * own balance card (or History's total, for the same period) depend on to
 * never visibly disagree. "To the cent," not bit-for-bit: each bucket's own
 * total is exact, but summing several already-divided bucket floats can
 * differ from a single grand-total division by float-addition noise on the
 * order of 1e-15 (e.g. `0.01 + 0.05 !== 0.06` in IEEE754) — invisible at the
 * 2-decimal display precision every screen actually renders, but not bit-
 * exact, so don't compare it with `toBe` in a test that sums multiple
 * same-`tipo` buckets. Clamping is applied unconditionally, not only for the
 * `mes`/`week` case that can currently overflow: 'day' and 'month'
 * granularities only stay aligned today because `periodRange` happens to
 * hand them an already-aligned range, which is an accident of the current
 * periodo↔granularity pairing, not a property the bucket math can rely on.
 */
export const series = (
  movimientos: Movimiento[],
  periodo: Periodo,
  range: DateRange,
  primerDiaSemana: 0 | 1,
  moneda: Moneda,
): SeriesBucket[] => {
  const granularity = GRANULARITY_FOR_PERIODO[periodo]
  const rangeStart = toLocalDate(range.from)
  const rangeEnd = toLocalDate(range.to)
  return bucketStartsFor(granularity, range, primerDiaSemana).map((naturalStart) => {
    const naturalEnd = bucketEndFor(granularity, naturalStart, primerDiaSemana)
    const start = naturalStart < rangeStart ? rangeStart : naturalStart
    const end = naturalEnd > rangeEnd ? rangeEnd : naturalEnd
    const bucketRange = { from: toIsoDate(start), to: toIsoDate(end) }
    const { ingresos, gastos } = totals(filterByRange(movimientos, bucketRange), moneda)
    return { bucketStart: bucketRange.from, ingresos, gastos }
  })
}
