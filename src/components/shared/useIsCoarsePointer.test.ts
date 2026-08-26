import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsCoarsePointer } from '@/components/shared/useIsCoarsePointer'

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

describe('useIsCoarsePointer', () => {
  it.each([true, false])('reflects the pointer:coarse query match: %s', (matches) => {
    stubMatchMedia(matches)
    const { result } = renderHook(() => useIsCoarsePointer())
    expect(result.current).toBe(matches)
  })
})
