import { format, isSameDay, parseISO, type Locale } from 'date-fns'
import type { Periodo } from '@/lib/schema'
import type { DateRange } from '@/lib/movimientoStats'

export interface PeriodLabel {
  title: string
  subtitle: string
}

export interface PeriodLabelStrings {
  today: string
  week: string
  summary: string
}

/**
 * Header title/subtitle for the currently viewed period. Pure formatting
 * over `range` (already resolved by `periodRange`) — never recomputes
 * boundaries itself. `today` is injectable so callers stay testable
 * (mirrors `repo.fake.ts`'s clock pattern).
 */
export const getPeriodLabel = (
  scope: Periodo,
  range: DateRange,
  today: Date,
  strings: PeriodLabelStrings,
  locale: Locale,
): PeriodLabel => {
  const from = parseISO(range.from)
  const to = parseISO(range.to)

  if (scope === 'dia') {
    return {
      title: isSameDay(from, today) ? strings.today : format(from, 'EEEE d', { locale }),
      subtitle: format(from, 'MMMM yyyy', { locale }),
    }
  }

  if (scope === 'semana') {
    return {
      title: `${format(from, 'd')}–${format(to, 'd MMM', { locale })}`,
      subtitle: `${strings.week} · ${format(from, 'MMMM yyyy', { locale })}`,
    }
  }

  if (scope === 'mes') {
    return { title: format(from, 'MMMM yyyy', { locale }), subtitle: strings.summary }
  }

  return { title: format(from, 'yyyy'), subtitle: strings.summary }
}
