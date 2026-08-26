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
  it.each([false, true])('reflects the orientation query match: %s', (matches) => {
    stubMatchMedia(matches)
    const { result } = renderHook(() => useIsLandscape())
    expect(result.current).toBe(matches)
  })
})
