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
  it('returns true on a coarse-pointer (touch) device', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsCoarsePointer())
    expect(result.current).toBe(true)
  })

  it('returns false on a fine-pointer (mouse/trackpad) device', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useIsCoarsePointer())
    expect(result.current).toBe(false)
  })

  it('degrades to false when matchMedia is unavailable (jsdom default)', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useIsCoarsePointer())
    expect(result.current).toBe(false)
  })
})
