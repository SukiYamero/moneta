import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsLandscape } from '@/components/shared/useIsLandscape'

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

describe('useIsLandscape', () => {
  it('returns false when the orientation query does not match', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useIsLandscape())
    expect(result.current).toBe(false)
  })

  it('returns true when the viewport is landscape', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsLandscape())
    expect(result.current).toBe(true)
  })

  it('degrades to false when matchMedia is unavailable (jsdom default)', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useIsLandscape())
    expect(result.current).toBe(false)
  })
})
