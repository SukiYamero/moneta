import type es from '@/lib/i18n/locales/es.json'
import type { DateRangePreset } from '@/features/search/dateRangePresets'

// Maps each preset to a translation key in the `search` namespace's
// `filters.dateRange` group — typed off `es.json` the same way
// `src/features/auth/errorCopy.ts` types its own lookup, so a typo here is
// a compile error instead of a silent `t()` miss. Shared by `FilterSheet`
// (its own preset chips) and `SearchScreen` (the active-filter chip once a
// preset is selected) — one lookup, so the two surfaces can't drift on wording.
type DateRangeKey = `filters.dateRange.${keyof typeof es.search.filters.dateRange}`

export const DATE_RANGE_PRESETS: DateRangePreset[] = ['all', '7d', '30d', 'month', 'year', 'custom']

export const DATE_RANGE_LABEL_KEY: Record<DateRangePreset, DateRangeKey> = {
  all: 'filters.dateRange.all',
  '7d': 'filters.dateRange.last7Days',
  '30d': 'filters.dateRange.last30Days',
  month: 'filters.dateRange.thisMonth',
  year: 'filters.dateRange.thisYear',
  custom: 'filters.dateRange.custom',
}
