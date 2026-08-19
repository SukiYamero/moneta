import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import type { TipoMovimiento } from '@/lib/schema'
import type { DateRange } from '@/lib/movimientoStats'
import { resolveDateRange, type DateRangePreset } from '@/features/search/dateRangePresets'
import { useDebouncedQuery } from '@/features/search/useDebouncedQuery'

export type MovementTypeFilter = 'all' | TipoMovimiento

const todayIso = (): string => format(new Date(), 'yyyy-MM-dd')

export interface UseSearchFiltersResult {
  query: string
  setQuery: (value: string) => void
  clearSearch: () => void
  /** Debounced (see `useDebouncedQuery`) — this is what actually drives filtering. */
  debouncedQuery: string
  rangePreset: DateRangePreset
  setRangePreset: (preset: DateRangePreset) => void
  customFrom: string
  setCustomFrom: (value: string) => void
  customTo: string
  setCustomTo: (value: string) => void
  typeFilter: MovementTypeFilter
  setTypeFilter: (value: MovementTypeFilter) => void
  selectedTags: string[]
  toggleTag: (name: string) => void
  /** Resolved bounds for `movimientoStats.filterByRange`, or `null` for no date filter. */
  dateRange: DateRange | null
  /** Any filter (date range, type, tags) narrows the set — independent of the search query. */
  isFilterActive: boolean
  /** Resets date/type/tag filters, not the search query — matches the Filter sheet's own "Limpiar". */
  clearFilters: () => void
}

/**
 * Owns every Search filter dimension: the debounced text query plus the
 * Filter sheet's date range/type/tags. One hook so `SearchScreen` and
 * `FilterSheet` always read the same live state — the sheet has no separate
 * "draft" to apply, taps commit immediately (matches the source design).
 */
export const useSearchFilters = (): UseSearchFiltersResult => {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedQuery(query)

  const [rangePreset, setRangePreset] = useState<DateRangePreset>('all')
  const [customFrom, setCustomFrom] = useState(todayIso)
  const [customTo, setCustomTo] = useState(todayIso)
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const dateRange = useMemo(
    () => resolveDateRange(rangePreset, { from: customFrom, to: customTo }),
    [rangePreset, customFrom, customTo],
  )

  const clearSearch = () => setQuery('')

  const toggleTag = (name: string) =>
    setSelectedTags((tags) =>
      tags.includes(name) ? tags.filter((t) => t !== name) : [...tags, name],
    )

  const clearFilters = () => {
    setRangePreset('all')
    setCustomFrom(todayIso())
    setCustomTo(todayIso())
    setTypeFilter('all')
    setSelectedTags([])
  }

  const isFilterActive = rangePreset !== 'all' || typeFilter !== 'all' || selectedTags.length > 0

  return {
    query,
    setQuery,
    clearSearch,
    debouncedQuery,
    rangePreset,
    setRangePreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    typeFilter,
    setTypeFilter,
    selectedTags,
    toggleTag,
    dateRange,
    isFilterActive,
    clearFilters,
  }
}
