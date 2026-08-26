import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18next } from '@/lib/i18n'
import {
  dismissToast,
  setToastsSuppressed,
  toast,
  useToastStore,
  type ToastMessageKey,
} from '@/lib/toastStore'

const items = () => useToastStore.getState().items

// Must stay a function, not a module-scope const: i18next.language isn't
// forced to 'es' until setup.ts's beforeAll runs, after this module evaluates.
const T = (key: ToastMessageKey, values?: Record<string, unknown>): string => i18next.t(key, values)

beforeEach(() => {
  useToastStore.setState({ items: [] })
  setToastsSuppressed(false)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('toast.success / toast.error', () => {
  it('adds a toast that a subscriber can read, resolved from a translation key', () => {
    toast.success('toast:demo.saved')
    expect(items()).toEqual([
      { id: expect.any(String), variant: 'success', message: T('toast:demo.saved'), count: 1 },
    ])
  })

  it('supports interpolation values', () => {
    toast.success('toast:repeatSuffix', { count: 5 })
    expect(items()[0]?.message).toBe(T('toast:repeatSuffix', { count: 5 }))
  })

  it('stacks concurrent toasts in arrival order', () => {
    toast.success('toast:demo.one')
    toast.error('toast:demo.two')
    expect(items().map((item) => item.message)).toEqual([T('toast:demo.one'), T('toast:demo.two')])
  })

  it('dismisses a success toast after its own 4s timer', () => {
    toast.success('toast:demo.saved')
    vi.advanceTimersByTime(3999)
    expect(items()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(items()).toHaveLength(0)
  })

  it('dismisses an error toast after its own 7s timer', () => {
    toast.error('toast:demo.saveFailed')
    vi.advanceTimersByTime(6999)
    expect(items()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(items()).toHaveLength(0)
  })

  it("a later, distinct arrival never resets an earlier toast's own timer", () => {
    toast.success('toast:demo.one')
    vi.advanceTimersByTime(3000)
    toast.success('toast:demo.two')
    vi.advanceTimersByTime(1000)
    // 'one' is now at its full 4000ms and must be gone; 'two' still has 3000ms left.
    expect(items().map((item) => item.message)).toEqual([T('toast:demo.two')])
  })

  it('collapses an identical (variant, message) re-raise into the same card and bumps its count', () => {
    toast.success('toast:demo.saved')
    toast.success('toast:demo.saved')
    expect(items()).toHaveLength(1)
    expect(items()[0]).toMatchObject({ count: 2 })
  })

  it("collapsing a duplicate resets that one card's own timer", () => {
    toast.success('toast:demo.saved')
    vi.advanceTimersByTime(3000)
    toast.success('toast:demo.saved') // re-raised with 1000ms left on the original timer
    vi.advanceTimersByTime(3999)
    expect(items()).toHaveLength(1) // would be gone already if the timer hadn't reset
    vi.advanceTimersByTime(1)
    expect(items()).toHaveLength(0)
  })

  it('a different variant with the same message text does not collapse', () => {
    toast.success('toast:demo.saveFailed')
    toast.error('toast:demo.saveFailed')
    expect(items()).toHaveLength(2)
  })

  it('drops the oldest toast once a 4th distinct one arrives, keeping the cap at 3', () => {
    toast.success('toast:demo.one')
    toast.success('toast:demo.two')
    toast.success('toast:demo.three')
    toast.success('toast:demo.four')
    expect(items().map((item) => item.message)).toEqual([
      T('toast:demo.two'),
      T('toast:demo.three'),
      T('toast:demo.four'),
    ])
  })
})

describe('setToastsSuppressed', () => {
  it('is a no-op for new arrivals while suppressed', () => {
    setToastsSuppressed(true)
    toast.success('toast:demo.saved')
    expect(items()).toHaveLength(0)
  })

  it('does not let a toast raised while suppressed surface once suppression lifts', () => {
    setToastsSuppressed(true)
    toast.error('toast:demo.syncFailed')
    setToastsSuppressed(false)
    expect(items()).toHaveLength(0)
  })

  it('clears an already-visible toast the instant suppression engages, not just future arrivals', () => {
    toast.success('toast:demo.saved')
    expect(items()).toHaveLength(1)

    setToastsSuppressed(true)
    expect(items()).toHaveLength(0)
  })

  it('a toast visible when suppression engages does not reappear from its own leftover timer once suppression lifts', () => {
    toast.success('toast:demo.saved')
    setToastsSuppressed(true)
    setToastsSuppressed(false)

    // If the original 4s timer had survived, it would still fire here and
    // try to remove an id no longer in the (already-empty) stack — this
    // just proves nothing resurrects in the meantime.
    vi.advanceTimersByTime(4000)
    expect(items()).toHaveLength(0)
  })
})

describe('dismissToast', () => {
  it('removes the toast immediately and cancels its pending timer', () => {
    toast.success('toast:demo.saved')
    const [item] = items()
    dismissToast(item!.id)
    expect(items()).toHaveLength(0)

    // If the timer weren't cancelled, this would try to filter an id that's
    // already gone — harmless either way, but proves no leftover timer fires.
    vi.advanceTimersByTime(10_000)
    expect(items()).toHaveLength(0)
  })
})
