import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVisualViewportInset } from '@/components/shared/useVisualViewportInset'

/** A minimal, real `EventTarget` — close enough to `VisualViewport` for `addEventListener`/`dispatchEvent` to behave like the browser API this hook subscribes to. */
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
    // `clientHeight` is always an integer; `visualViewport.height`/`offsetTop`
    // come out fractional at ordinary non-100% zoom levels even with no
    // keyboard and no pan — a strict `===` would misread that as a shrunk
    // viewport and needlessly leave the static `dvh` fallback behind.
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
