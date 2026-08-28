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

// `new Date('yyyy-mm-dd')` parses as UTC midnight per the ECMAScript Date
// Time String Format spec, one calendar day off under a negative UTC offset.
// `parseISO` parses a date-only string as local midnight instead.
const toLocalDate = (iso: string): Date => parseISO(iso)

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

export const periodRange = (
  periodo: Periodo,
  anchor: string,
  primerDiaSemana: 0 | 1,
): DateRange => {
  const { start, end } = RANGE_FOR_PERIODO[periodo](toLocalDate(anchor), primerDiaSemana)
  return { from: toIsoDate(start), to: toIsoDate(end) }
}

export const filterByRange = (movimientos: Movimiento[], range: DateRange): Movimiento[] =>
  movimientos.filter((m) => m.fecha >= range.from && m.fecha <= range.to)

const MINOR_UNITS_PER_MONTO = 100

// JS numbers are IEEE754 doubles; summing them directly drifts (0.1 + 0.2 !== 0.3).
const toMinorUnits = (monto: number): number => Math.round(monto * MINOR_UNITS_PER_MONTO)
const fromMinorUnits = (minor: number): number => minor / MINOR_UNITS_PER_MONTO

const sumMinorUnits = (movimientos: Movimiento[]): number =>
  movimientos.reduce((sum, m) => sum + toMinorUnits(m.monto), 0)

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

export const otherCurrencies = (movimientos: Movimiento[], moneda: Moneda): Moneda[] => {
  const seen = new Set<Moneda>()
  for (const m of movimientos) {
    if (m.moneda !== moneda) seen.add(m.moneda)
  }
  return [...seen]
}

export const breakdownBy = (
  movimientos: Movimiento[],
  tipo: Movimiento['tipo'],
  moneda: Moneda,
): BreakdownEntry[] => {
  const filtered = movimientos.filter((m) => m.tipo === tipo && m.moneda === moneda)
  const minorByKey = new Map<string, number>()
  for (const m of filtered) {
    const key = m.categoria
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

type BucketGranularity = 'day' | 'week' | 'month'

const GRANULARITY_FOR_PERIODO: Record<Periodo, BucketGranularity> = {
  dia: 'day',
  semana: 'day',
  mes: 'week',
  anio: 'month',
}

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
