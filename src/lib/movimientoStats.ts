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
import type { Movimiento, Periodo } from '@/lib/schema'

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
const toIsoDate = (date: Date): string => format(date, ISO_DATE_FORMAT)

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

/** `{ ingresos, gastos, balance }`, all in normal units, summed without float drift. */
export const totals = (movimientos: Movimiento[]): Totals => {
  const ingresosMinor = sumMinorUnits(movimientos.filter((m) => m.tipo === 'ingreso'))
  const gastosMinor = sumMinorUnits(movimientos.filter((m) => m.tipo === 'gasto'))
  return {
    ingresos: fromMinorUnits(ingresosMinor),
    gastos: fromMinorUnits(gastosMinor),
    balance: fromMinorUnits(ingresosMinor - gastosMinor),
  }
}

/**
 * Totals grouped by `seccion` or `categoria`, optionally pre-filtered by
 * `tipo`, sorted by total desc. `share` is each group's fraction of the
 * grand total (summing to 1), or 0 for every entry when the grand total is 0
 * — never `NaN`.
 */
export const breakdownBy = (
  movimientos: Movimiento[],
  groupKey: 'seccion' | 'categoria',
  tipo?: Movimiento['tipo'],
): BreakdownEntry[] => {
  const filtered = tipo === undefined ? movimientos : movimientos.filter((m) => m.tipo === tipo)
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

const bucketStartsFor = (
  granularity: BucketGranularity,
  range: DateRange,
  primerDiaSemana: 0 | 1,
): Date[] => {
  const interval = { start: toLocalDate(range.from), end: toLocalDate(range.to) }
  if (granularity === 'month') return eachMonthOfInterval(interval)
  if (granularity === 'week') return eachWeekOfInterval(interval, { weekStartsOn: primerDiaSemana })
  return eachDayOfInterval(interval)
}

const bucketEndFor = (
  granularity: BucketGranularity,
  start: Date,
  primerDiaSemana: 0 | 1,
): Date => {
  if (granularity === 'month') return endOfMonth(start)
  if (granularity === 'week') return endOfWeek(start, { weekStartsOn: primerDiaSemana })
  return start
}

/**
 * One bucket per sub-period covering `range`, including empty buckets (a
 * week with no movements still needs seven bars). Sub-period granularity is
 * a property of `periodo` (day/week/month bars for semana/mes/anio
 * respectively; a single bucket for dia), not of the chart consumer.
 */
export const series = (
  movimientos: Movimiento[],
  periodo: Periodo,
  range: DateRange,
  primerDiaSemana: 0 | 1,
): SeriesBucket[] => {
  const granularity = GRANULARITY_FOR_PERIODO[periodo]
  return bucketStartsFor(granularity, range, primerDiaSemana).map((start) => {
    const end = bucketEndFor(granularity, start, primerDiaSemana)
    const bucketRange = { from: toIsoDate(start), to: toIsoDate(end) }
    const { ingresos, gastos } = totals(filterByRange(movimientos, bucketRange))
    return { bucketStart: bucketRange.from, ingresos, gastos }
  })
}
