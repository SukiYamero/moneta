import { useMemo, useState } from 'react'
import type { TipoMovimiento } from '@/lib/schema'
import { toIsoDate, type DateRange } from '@/lib/movimientoStats'
import { resolveDateRange, type DateRangePreset } from '@/features/search/dateRangePresets'
import { useDebouncedQuery } from '@/features/search/useDebouncedQuery'

export type MovementTypeFilter = 'all' | TipoMovimiento

const todayIso = (): string => toIsoDate(new Date())

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
  /** Category ids (specs.md §10.22) — never display names. */
  selectedTags: string[]
  toggleTag: (id: string) => void
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

  const toggleTag = (id: string) =>
    setSelectedTags((tags) => (tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id]))

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
