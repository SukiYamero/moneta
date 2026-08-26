import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMediaQuery } from '@/components/shared/useMediaQuery'

afterEach(() => {
  vi.unstubAllGlobals()
})

const stubMatchMedia = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('useMediaQuery', () => {
  it('returns false when the query does not match', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(pointer: coarse)'))
    expect(result.current).toBe(false)
  })

  it('returns true when the query matches', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(pointer: coarse)'))
    expect(result.current).toBe(true)
  })

  it('degrades to false when matchMedia is unavailable (jsdom default)', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useMediaQuery('(pointer: coarse)'))
    expect(result.current).toBe(false)
  })
})
