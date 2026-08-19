import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePendingDelay } from '@/components/shared/usePendingDelay'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePendingDelay()', () => {
  it('does not show while never pending', () => {
    const { result } = renderHook(() => usePendingDelay(false))
    expect(result.current).toBe(false)
  })

  it('never shows if the work resolves before the show-delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: true } },
    )

    act(() => vi.advanceTimersByTime(100))
    rerender({ pending: false })
    act(() => vi.advanceTimersByTime(1000))

    expect(result.current).toBe(false)
  })

  it('shows once the work has stayed pending for the full show-delay', () => {
    const { result } = renderHook(() => usePendingDelay(true, { delayMs: 150, minVisibleMs: 350 }))

    act(() => vi.advanceTimersByTime(149))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })

  it('keeps showing for the minimum-visible time even if pending resolves right after it appears', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: true } },
    )

    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe(true)

    rerender({ pending: false })
    act(() => vi.advanceTimersByTime(349))
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(false)
  })

  it('hides immediately once pending resolves after already outlasting the minimum-visible time', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: true } },
    )

    act(() => vi.advanceTimersByTime(150))
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(true)

    rerender({ pending: false })
    act(() => vi.advanceTimersByTime(0))

    expect(result.current).toBe(false)
  })

  it('never shows on a pending flicker that never holds long enough, even across several restarts', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: false } },
    )

    rerender({ pending: true })
    act(() => vi.advanceTimersByTime(80))
    rerender({ pending: false })
    act(() => vi.advanceTimersByTime(80))
    rerender({ pending: true })
    act(() => vi.advanceTimersByTime(80))

    expect(result.current).toBe(false)
  })

  it('resumes showing without a new delay if pending returns while still within the minimum-visible window', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: true } },
    )

    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe(true)

    rerender({ pending: false })
    act(() => vi.advanceTimersByTime(100))
    rerender({ pending: true })
    // Still shown throughout — no flicker back to hidden between resolve and re-pend.
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(true)
  })

  it('clears its timers on unmount without leaking a scheduled state update', () => {
    const { unmount } = renderHook(() => usePendingDelay(true, { delayMs: 150, minVisibleMs: 350 }))
    unmount()
    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow()
  })

  it('defaults to a ~150ms show delay and ~350ms minimum-visible time', () => {
    const { result } = renderHook(() => usePendingDelay(true))

    act(() => vi.advanceTimersByTime(149))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })

  it('clears its hide-timer on unmount without leaking a scheduled state update', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender, unmount } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: true } },
    )

    // Shown, then pending resolves so the 350ms minimum-visible hide-timer
    // is the one in flight at unmount time — the show-timer unmount test
    // above never exercises this second timer.
    act(() => vi.advanceTimersByTime(150))
    rerender({ pending: false })
    unmount()

    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('never leaks a timer across a rapid isPending retry-loop flapping many times before and after it shows', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => usePendingDelay(pending, { delayMs: 150, minVisibleMs: 350 }),
      { initialProps: { pending: false } },
    )

    // Flicker below the show-delay several times — never shows, never leaks.
    for (let i = 0; i < 5; i++) {
      rerender({ pending: true })
      act(() => vi.advanceTimersByTime(50))
      rerender({ pending: false })
      act(() => vi.advanceTimersByTime(50))
    }
    expect(result.current).toBe(false)

    // Now hold pending long enough to show, then flap rapidly while shown —
    // the minimum-visible window must never restart or double-schedule.
    rerender({ pending: true })
    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe(true)

    for (let i = 0; i < 5; i++) {
      rerender({ pending: false })
      act(() => vi.advanceTimersByTime(20))
      rerender({ pending: true })
      act(() => vi.advanceTimersByTime(20))
    }
    expect(result.current).toBe(true)

    // Settle fully: whatever hide-timer is left in flight fires, and once
    // it does, no further timer gets scheduled behind it — a leak would
    // show up as a still-nonzero fake-timer count here.
    act(() => vi.advanceTimersByTime(1000))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts the show-delay from the current instant if delayMs changes while still pending and not yet shown (documented current behavior)', () => {
    const { result, rerender } = renderHook(
      ({ pending, delayMs }) => usePendingDelay(pending, { delayMs, minVisibleMs: 350 }),
      { initialProps: { pending: true, delayMs: 150 } },
    )

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(false)

    // delayMs changes mid-flight — the in-flight 150ms timer is cleared and
    // a fresh 200ms one starts from now, it does not credit the 100ms
    // already elapsed under the old value.
    rerender({ pending: true, delayMs: 200 })
    act(() => vi.advanceTimersByTime(199))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })
})
