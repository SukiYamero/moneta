import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSearchFilters } from '@/features/search/useSearchFilters'

describe('useSearchFilters()', () => {
  it('starts with every filter inactive and no date range', () => {
    const { result } = renderHook(() => useSearchFilters())
    expect(result.current.isFilterActive).toBe(false)
    expect(result.current.dateRange).toBeNull()
    expect(result.current.typeFilter).toBe('all')
    expect(result.current.selectedTags).toEqual([])
  })

  it('setRangePreset("month") activates filtering and resolves a real date range', () => {
    const { result } = renderHook(() => useSearchFilters())
    act(() => result.current.setRangePreset('month'))
    expect(result.current.isFilterActive).toBe(true)
    expect(result.current.dateRange).not.toBeNull()
  })

  it('setTypeFilter activates filtering', () => {
    const { result } = renderHook(() => useSearchFilters())
    act(() => result.current.setTypeFilter('gasto'))
    expect(result.current.isFilterActive).toBe(true)
  })

  it('toggleTag adds then removes the same tag', () => {
    const { result } = renderHook(() => useSearchFilters())
    act(() => result.current.toggleTag('Comida'))
    expect(result.current.selectedTags).toEqual(['Comida'])
    expect(result.current.isFilterActive).toBe(true)

    act(() => result.current.toggleTag('Comida'))
    expect(result.current.selectedTags).toEqual([])
    expect(result.current.isFilterActive).toBe(false)
  })

  it('toggleTag keeps multiple tags independently selected', () => {
    const { result } = renderHook(() => useSearchFilters())
    act(() => result.current.toggleTag('Comida'))
    act(() => result.current.toggleTag('Transporte'))
    expect(result.current.selectedTags).toEqual(['Comida', 'Transporte'])
  })

  it('clearFilters resets range/type/tags but leaves the search query untouched', () => {
    const { result } = renderHook(() => useSearchFilters())
    act(() => result.current.setQuery('comida'))
    act(() => result.current.setRangePreset('year'))
    act(() => result.current.setTypeFilter('ingreso'))
    act(() => result.current.toggleTag('Comida'))

    act(() => result.current.clearFilters())

    expect(result.current.isFilterActive).toBe(false)
    expect(result.current.dateRange).toBeNull()
    expect(result.current.typeFilter).toBe('all')
    expect(result.current.selectedTags).toEqual([])
    expect(result.current.query).toBe('comida')
  })

  it('clearSearch empties the query', () => {
    const { result } = renderHook(() => useSearchFilters())
    act(() => result.current.setQuery('comida'))
    act(() => result.current.clearSearch())
    expect(result.current.query).toBe('')
  })
})
