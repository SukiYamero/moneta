import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedQuery } from '@/features/search/useDebouncedQuery'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedQuery()', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedQuery('comida', 300))
    expect(result.current).toBe('comida')
  })

  it('holds the previous value until the delay elapses', () => {
    const { result, rerender } = renderHook(({ query }) => useDebouncedQuery(query, 300), {
      initialProps: { query: 'com' },
    })

    rerender({ query: 'comi' })
    expect(result.current).toBe('com')

    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('com')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('comi')
  })

  it('restarts the delay on every keystroke, so only the settled value ever commits', () => {
    const { result, rerender } = renderHook(({ query }) => useDebouncedQuery(query, 300), {
      initialProps: { query: 'c' },
    })

    rerender({ query: 'co' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ query: 'com' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('c')

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('com')
  })

  it('clearing to an empty query commits immediately, without waiting for the delay', () => {
    const { result, rerender } = renderHook(({ query }) => useDebouncedQuery(query, 300), {
      initialProps: { query: 'comida' },
    })

    rerender({ query: '' })
    expect(result.current).toBe('')
  })
})
