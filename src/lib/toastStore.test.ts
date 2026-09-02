import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18next } from '@/lib/i18n'
import {
  dismissToast,
  removeToast,
  setToastsSuppressed,
  toast,
  useToastStore,
  type ToastMessageKey,
} from '@/lib/toastStore'

const items = () => useToastStore.getState().items

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
      {
        id: expect.any(String),
        variant: 'success',
        message: T('toast:demo.saved'),
        count: 1,
        exiting: false,
      },
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

  it('flags a success toast as exiting after its own 4s timer, without removing it yet', () => {
    toast.success('toast:demo.saved')
    vi.advanceTimersByTime(3999)
    expect(items()[0]).toMatchObject({ exiting: false })
    vi.advanceTimersByTime(1)
    expect(items()[0]).toMatchObject({ exiting: true })
  })

  it('flags an error toast as exiting after its own 7s timer', () => {
    toast.error('toast:demo.saveFailed')
    vi.advanceTimersByTime(6999)
    expect(items()[0]).toMatchObject({ exiting: false })
    vi.advanceTimersByTime(1)
    expect(items()[0]).toMatchObject({ exiting: true })
  })

  it("a later, distinct arrival never resets an earlier toast's own timer", () => {
    toast.success('toast:demo.one')
    vi.advanceTimersByTime(3000)
    toast.success('toast:demo.two')
    vi.advanceTimersByTime(1000)
    const first = items().find((item) => item.message === T('toast:demo.one'))
    expect(first).toMatchObject({ exiting: true })
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
    toast.success('toast:demo.saved')
    vi.advanceTimersByTime(3999)
    expect(items()[0]).toMatchObject({ exiting: false })
    vi.advanceTimersByTime(1)
    expect(items()[0]).toMatchObject({ exiting: true })
  })

  it('a re-raise while an identical earlier one is already exiting starts a fresh card instead of reviving it', () => {
    toast.success('toast:demo.saved')
    dismissToast(items()[0]!.id)
    toast.success('toast:demo.saved')
    expect(items()).toHaveLength(2)
    expect(items()[0]).toMatchObject({ exiting: true, count: 1 })
    expect(items()[1]).toMatchObject({ exiting: false, count: 1 })
  })

  it('a different variant with the same message text does not collapse', () => {
    toast.success('toast:demo.saveFailed')
    toast.error('toast:demo.saveFailed')
    expect(items()).toHaveLength(2)
  })

  it('flags the oldest toast as exiting (not removed yet) once a 4th distinct one arrives, keeping 3 visible', () => {
    toast.success('toast:demo.one')
    toast.success('toast:demo.two')
    toast.success('toast:demo.three')
    toast.success('toast:demo.four')

    expect(items().map((item) => item.message)).toEqual([
      T('toast:demo.one'),
      T('toast:demo.two'),
      T('toast:demo.three'),
      T('toast:demo.four'),
    ])
    expect(items()[0]).toMatchObject({ exiting: true })
    expect(
      items()
        .slice(1)
        .every((item) => !item.exiting),
    ).toBe(true)

    removeToast(items()[0]!.id)
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

    vi.advanceTimersByTime(4000)
    expect(items()).toHaveLength(0)
  })
})

describe('dismissToast', () => {
  it('flags the toast as exiting and cancels its pending auto-dismiss timer, without removing it yet', () => {
    toast.success('toast:demo.saved')
    const [item] = items()
    dismissToast(item!.id)
    expect(items()).toMatchObject([{ exiting: true }])

    vi.advanceTimersByTime(10_000)
    expect(items()).toMatchObject([{ exiting: true }])
  })
})

describe('removeToast', () => {
  it('removes the toast from the stack', () => {
    toast.success('toast:demo.saved')
    const [item] = items()
    dismissToast(item!.id)
    removeToast(item!.id)
    expect(items()).toHaveLength(0)
  })
})
