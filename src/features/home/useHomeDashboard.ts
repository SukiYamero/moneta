import { useEffect, useMemo } from 'react'
import { addDays, parseISO } from 'date-fns'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { useDataStore, type DataStatus } from '@/lib/dataStore'
import type { RepoErrorCode } from '@/lib/repo'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Categoria, Moneda, Movimiento } from '@/lib/schema'
import {
  filterByRange,
  otherCurrencies,
  periodRange,
  series,
  toIsoDate,
  totals,
  type DateRange,
  type SeriesBucket,
  type Totals,
} from '@/lib/movimientoStats'
import { buildWeekStripDays, monthYearLabel, type WeekStripDay } from '@/features/home/homeView'

const RECENT_LIMIT = 6

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
  totals: Totals
  otherCurrencies: Moneda[]
  weekStripDays: WeekStripDay[]
  week: { range: DateRange; totalGastos: number; chart: SeriesBucket[] }
  recent: Movimiento[]
  categorias: Categoria[]
  retry: () => void
}

export const useHomeDashboard = (): HomeDashboard => {
  const status = useDataStore((s) => s.status)
  const error = useDataStore((s) => s.error)
  const movimientos = useDataStore((s) => s.movimientos)
  const config = useDataStore((s) => s.config)
  const load = useDataStore((s) => s.load)
  const { dateFnsLocale } = useLocaleFormatting()

  useEffect(() => {
    void load()
  }, [load])

  const todayIso = useMemo(() => toIsoDate(new Date()), [])
  const primerDiaSemana =
    config?.preferencias.primerDiaSemana ?? CONFIG_SEMILLA.preferencias.primerDiaSemana
  const moneda = config?.preferencias.monedaPrincipal ?? CONFIG_SEMILLA.preferencias.monedaPrincipal

  const weekRange = useMemo(
    () => periodRange('semana', todayIso, primerDiaSemana),
    [todayIso, primerDiaSemana],
  )

  const monthLabel = useMemo(
    () => monthYearLabel(addDays(parseISO(weekRange.from), 3), dateFnsLocale),
    [weekRange, dateFnsLocale],
  )

  const allTotals = useMemo(() => totals(movimientos, moneda), [movimientos, moneda])

  const otherCurrenciesPresent = useMemo(
    () => otherCurrencies(movimientos, moneda),
    [movimientos, moneda],
  )

  const weekTotalGastos = useMemo(
    () => totals(filterByRange(movimientos, weekRange), moneda).gastos,
    [movimientos, weekRange, moneda],
  )

  const chart = useMemo(
    () => series(movimientos, 'semana', weekRange, primerDiaSemana, moneda),
    [movimientos, weekRange, primerDiaSemana, moneda],
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
    otherCurrencies: otherCurrenciesPresent,
    weekStripDays,
    week: { range: weekRange, totalGastos: weekTotalGastos, chart },
    recent,
    categorias: config?.categorias ?? CONFIG_SEMILLA.categorias,
    retry: () => void load(),
  }
}
