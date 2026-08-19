import { useEffect, useMemo } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { useDataStore, type DataStatus } from '@/lib/dataStore'
import type { RepoErrorCode } from '@/lib/repo'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Moneda, Movimiento } from '@/lib/schema'
import {
  filterByRange,
  periodRange,
  series,
  totals,
  type DateRange,
  type SeriesBucket,
  type Totals,
} from '@/lib/movimientoStats'
import { buildWeekStripDays, monthYearLabel, type WeekStripDay } from '@/features/home/homeView'

const RECENT_LIMIT = 6

// Most recent movement first: `fecha` (the transaction date) is the primary
// key, `createdAt` (audit timestamp) breaks ties for same-day entries —
// both ISO strings, so a plain string comparison is chronological order.
const sortByRecency = (a: Movimiento, b: Movimiento): number => {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}

export interface HomeDashboard {
  status: DataStatus
  error: RepoErrorCode | null
  isEmpty: boolean
  moneda: Moneda
  todayIso: string
  monthLabel: string
  /** All-time totals — "Balance total" is the running balance, not scoped to a period. */
  totals: Totals
  weekStripDays: WeekStripDay[]
  week: { range: DateRange; totalGastos: number; chart: SeriesBucket[] }
  recent: Movimiento[]
  retry: () => void
}

/**
 * Everything the Home dashboard renders, derived from the shared
 * `dataStore` (never a separate repo read — see repoProvider.ts) through
 * `movimientoStats`'s pure functions, so this screen's numbers cannot
 * disagree with History's or Search's for the same data.
 */
export const useHomeDashboard = (): HomeDashboard => {
  const status = useDataStore((s) => s.status)
  const error = useDataStore((s) => s.error)
  const movimientos = useDataStore((s) => s.movimientos)
  const config = useDataStore((s) => s.config)
  const load = useDataStore((s) => s.load)
  const { dateFnsLocale } = useLocaleFormatting()

  // load() is idempotent/race-safe (dataStore.ts) — safe to call unconditionally
  // on mount, mirroring RequireAuth's own `void store.action()` pattern.
  useEffect(() => {
    void load()
  }, [load])

  const todayIso = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const primerDiaSemana =
    config?.preferencias.primerDiaSemana ?? CONFIG_SEMILLA.preferencias.primerDiaSemana
  const moneda = config?.preferencias.monedaPrincipal ?? CONFIG_SEMILLA.preferencias.monedaPrincipal

  const weekRange = useMemo(
    () => periodRange('semana', todayIso, primerDiaSemana),
    [todayIso, primerDiaSemana],
  )

  // Mid-week anchor for the month label, so a week straddling a month
  // boundary reads as the month most of it belongs to (matches the design).
  const monthLabel = useMemo(
    () => monthYearLabel(addDays(parseISO(weekRange.from), 3), dateFnsLocale),
    [weekRange, dateFnsLocale],
  )

  const allTotals = useMemo(() => totals(movimientos), [movimientos])

  const weekTotalGastos = useMemo(
    () => totals(filterByRange(movimientos, weekRange)).gastos,
    [movimientos, weekRange],
  )

  const chart = useMemo(
    () => series(movimientos, 'semana', weekRange, primerDiaSemana),
    [movimientos, weekRange, primerDiaSemana],
  )

  const weekStripDays = useMemo(
    () => buildWeekStripDays(movimientos, weekRange, todayIso, dateFnsLocale),
    [movimientos, weekRange, todayIso, dateFnsLocale],
  )

  const recent = useMemo(
    () => movimientos.toSorted(sortByRecency).slice(0, RECENT_LIMIT),
    [movimientos],
  )

  return {
    status,
    error,
    isEmpty: status === 'ready' && movimientos.length === 0,
    moneda,
    todayIso,
    monthLabel,
    totals: allTotals,
    weekStripDays,
    week: { range: weekRange, totalGastos: weekTotalGastos, chart },
    recent,
    retry: () => void load(),
  }
}
