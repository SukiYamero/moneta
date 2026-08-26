import type es from '@/lib/i18n/locales/es.json'
import type { DateRangePreset } from '@/features/search/dateRangePresets'

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
