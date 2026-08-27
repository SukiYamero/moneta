import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVisualViewportInset } from '@/components/shared/useVisualViewportInset'

// jsdom has no VisualViewport implementation.
class FakeVisualViewport extends EventTarget {
  offsetTop = 0
  height = document.documentElement.clientHeight
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVisualViewportInset', () => {
  it('returns null when disabled, even with a shrunk visual viewport', () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 400
    vi.stubGlobal('visualViewport', viewport)

    const { result } = renderHook(() => useVisualViewportInset(false))

    expect(result.current).toBeNull()
  })

  it('returns null when the API is unavailable (jsdom default)', () => {
    vi.stubGlobal('visualViewport', undefined)

    const { result } = renderHook(() => useVisualViewportInset(true))

    expect(result.current).toBeNull()
  })

  it('returns null when the visual viewport matches the layout viewport (keyboard closed, no pan)', () => {
    const viewport = new FakeVisualViewport()
    vi.stubGlobal('visualViewport', viewport)

    const { result } = renderHook(() => useVisualViewportInset(true))

    expect(result.current).toBeNull()
  })

  it('returns null for a sub-pixel mismatch (browser/page zoom rounding, no keyboard, no pan)', () => {
    // `clientHeight` is always an integer; `visualViewport.height`/`offsetTop` can be fractional at non-100% zoom.
    const viewport = new FakeVisualViewport()
    viewport.height = document.documentElement.clientHeight - 0.4
    viewport.offsetTop = 0.4
    vi.stubGlobal('visualViewport', viewport)

    const { result } = renderHook(() => useVisualViewportInset(true))

    expect(result.current).toBeNull()
  })

  it('reports the real inset once the visual viewport shrinks or pans, and updates live on resize/scroll', () => {
    const viewport = new FakeVisualViewport()
    vi.stubGlobal('visualViewport', viewport)

    const { result } = renderHook(() => useVisualViewportInset(true))
    expect(result.current).toBeNull()

    act(() => {
      viewport.height = 400
      viewport.offsetTop = 120
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toEqual({ top: 120, height: 400 })

    act(() => {
      viewport.offsetTop = 60
      viewport.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toEqual({ top: 60, height: 400 })
  })

  it('re-checks itself shortly after a resize event, catching a value the keyboard animation had not settled to yet', () => {
    vi.useFakeTimers()
    const viewport = new FakeVisualViewport()
    vi.stubGlobal('visualViewport', viewport)

    const { result } = renderHook(() => useVisualViewportInset(true))

    act(() => {
      viewport.height = 400
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toEqual({ top: 0, height: 400 })

    // The keyboard finished closing without firing another event; nothing
    // but the scheduled re-check ever reads the now-correct value.
    viewport.height = document.documentElement.clientHeight

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBeNull()

    vi.useRealTimers()
  })

  it('stops listening once disabled, and removes both listeners on unmount', () => {
    const viewport = new FakeVisualViewport()
    vi.stubGlobal('visualViewport', viewport)
    const removeSpy = vi.spyOn(viewport, 'removeEventListener')

    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useVisualViewportInset(enabled),
      { initialProps: { enabled: true } },
    )

    act(() => {
      viewport.height = 400
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(result.current).not.toBeNull()

    rerender({ enabled: false })
    expect(result.current).toBeNull()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))

    unmount()
  })
})
