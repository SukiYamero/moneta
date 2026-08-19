import { useCallback, useState } from 'react'
import { addDays, addMonths, addWeeks, addYears, format, parseISO, setYear } from 'date-fns'
import type { Periodo } from '@/lib/schema'

const ISO_DATE_FORMAT = 'yyyy-MM-dd'
const toIsoDate = (date: Date): string => format(date, ISO_DATE_FORMAT)

// One calendar step per periodo — moving the anchor this way and letting
// `periodRange` (movimientoStats.ts) recompute the exact bounds is what
// keeps month/year-end stepping correct: date-fns clamps day-of-month
// overflow (e.g. addMonths(Jan 31, 1) -> Feb 28) but always lands inside the
// intended next/previous calendar unit.
const STEP_FN: Record<Periodo, (date: Date, amount: number) => Date> = {
  dia: addDays,
  semana: addWeeks,
  mes: addMonths,
  anio: addYears,
}

export interface UseHistoryPeriodOptions {
  /** Injectable "today", mirroring repo.fake.ts's clock pattern — keeps tests deterministic. */
  today?: Date
}

export interface UseHistoryPeriodResult {
  scope: Periodo
  /** ISO `yyyy-mm-dd` — any date inside the currently viewed period; `periodRange` resolves the exact bounds. */
  anchor: string
  setScope: (scope: Periodo) => void
  /** Jumps straight to the period containing `iso` (day/week/month/year picker chips). */
  selectAnchor: (iso: string) => void
  /** Moves to the next/previous period of the current scope. */
  step: (direction: 1 | -1) => void
  /** Replaces the anchor's year, keeping month/day (year menu). */
  selectYear: (year: number) => void
}

/**
 * Owns only the "which period is the user looking at" state — a scope plus
 * an anchor date. Every number shown for that period is still derived by
 * the caller via `movimientoStats.periodRange`/`filterByRange`/`totals`,
 * never computed here.
 */
export const useHistoryPeriod = ({
  today = new Date(),
}: UseHistoryPeriodOptions = {}): UseHistoryPeriodResult => {
  const [scope, setScope] = useState<Periodo>('dia')
  const [anchor, setAnchor] = useState<string>(() => toIsoDate(today))

  const step = useCallback(
    (direction: 1 | -1) => {
      setAnchor((current) => toIsoDate(STEP_FN[scope](parseISO(current), direction)))
    },
    [scope],
  )

  const selectYear = useCallback((year: number) => {
    setAnchor((current) => toIsoDate(setYear(parseISO(current), year)))
  }, [])

  return { scope, anchor, setScope, selectAnchor: setAnchor, step, selectYear }
}
