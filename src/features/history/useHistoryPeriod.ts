import { useCallback, useState } from 'react'
import { addDays, addMonths, addWeeks, addYears, getYear, parseISO } from 'date-fns'
import type { Periodo } from '@/lib/schema'
import { toIsoDate } from '@/lib/movimientoStats'

// date-fns clamps day-of-month overflow (e.g. addMonths(Jan 31, 1) -> Feb
// 28) rather than rolling into the next calendar unit.
const STEP_FN: Record<Periodo, (date: Date, amount: number) => Date> = {
  dia: addDays,
  semana: addWeeks,
  mes: addMonths,
  anio: addYears,
}

export interface UseHistoryPeriodOptions {
  today?: Date
}

export interface UseHistoryPeriodResult {
  scope: Periodo
  anchor: string
  setScope: (scope: Periodo) => void
  selectAnchor: (iso: string) => void
  step: (direction: 1 | -1) => void
  selectYear: (year: number) => void
}

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

  // date-fns's setYear doesn't clamp a Feb 29 anchor for a non-leap year
  // (rolls into March 1) — addYears does.
  const selectYear = useCallback((year: number) => {
    setAnchor((current) => {
      const date = parseISO(current)
      return toIsoDate(addYears(date, year - getYear(date)))
    })
  }, [])

  return { scope, anchor, setScope, selectAnchor: setAnchor, step, selectYear }
}
