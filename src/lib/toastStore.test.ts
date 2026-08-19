import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Reassigned per test — this suite only cares about what toastStore does
// with the lock phase, not lockStore's own behavior (which has its own
// tests). Vitest hoists vi.mock above the imports below regardless of
// source order, same pattern as AppLock.test.tsx.
let lockPhase: 'unknown' | 'unlocked' | 'locked' = 'unlocked'

vi.mock('@/lib/lockStore', () => ({
  useLockStore: { getState: () => ({ phase: lockPhase }) },
}))

import { dismissToast, toast, useToastStore } from '@/lib/toastStore'

const items = () => useToastStore.getState().items

beforeEach(() => {
  lockPhase = 'unlocked'
  useToastStore.setState({ items: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('toast.success / toast.error', () => {
  it('adds a toast that a subscriber can read', () => {
    toast.success('Guardado')
    expect(items()).toEqual([
      { id: expect.any(String), variant: 'success', message: 'Guardado', count: 1 },
    ])
  })

  it('stacks concurrent toasts in arrival order', () => {
    toast.success('Primero')
    toast.error('Segundo')
    expect(items().map((item) => item.message)).toEqual(['Primero', 'Segundo'])
  })

  it('dismisses a success toast after its own 4s timer', () => {
    toast.success('Guardado')
    vi.advanceTimersByTime(3999)
    expect(items()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(items()).toHaveLength(0)
  })

  it('dismisses an error toast after its own 7s timer', () => {
    toast.error('Falló el guardado')
    vi.advanceTimersByTime(6999)
    expect(items()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(items()).toHaveLength(0)
  })

  it("a later, distinct arrival never resets an earlier toast's own timer", () => {
    toast.success('Primero')
    vi.advanceTimersByTime(3000)
    toast.success('Segundo')
    vi.advanceTimersByTime(1000)
    // 'Primero' is now at its full 4000ms and must be gone; 'Segundo' still has 3000ms left.
    expect(items().map((item) => item.message)).toEqual(['Segundo'])
  })

  it('collapses an identical (variant, message) re-raise into the same card and bumps its count', () => {
    toast.success('Guardado')
    toast.success('Guardado')
    expect(items()).toHaveLength(1)
    expect(items()[0]).toMatchObject({ count: 2 })
  })

  it("collapsing a duplicate resets that one card's own timer", () => {
    toast.success('Guardado')
    vi.advanceTimersByTime(3000)
    toast.success('Guardado') // re-raised with 1000ms left on the original timer
    vi.advanceTimersByTime(3999)
    expect(items()).toHaveLength(1) // would be gone already if the timer hadn't reset
    vi.advanceTimersByTime(1)
    expect(items()).toHaveLength(0)
  })

  it('a different variant with the same message text does not collapse', () => {
    toast.success('No se pudo guardar')
    toast.error('No se pudo guardar')
    expect(items()).toHaveLength(2)
  })

  it('drops the oldest toast once a 4th distinct one arrives, keeping the cap at 3', () => {
    toast.success('a')
    toast.success('b')
    toast.success('c')
    toast.success('d')
    expect(items().map((item) => item.message)).toEqual(['b', 'c', 'd'])
  })

  it('is a no-op while the app is locked', () => {
    lockPhase = 'locked'
    toast.success('Guardado en segundo plano')
    expect(items()).toHaveLength(0)
  })

  it('does not surface after unlocking a toast that was raised while locked', () => {
    lockPhase = 'locked'
    toast.error('Falló mientras estaba bloqueado')
    lockPhase = 'unlocked'
    expect(items()).toHaveLength(0)
  })
})

describe('dismissToast', () => {
  it('removes the toast immediately and cancels its pending timer', () => {
    toast.success('Guardado')
    const [item] = items()
    dismissToast(item!.id)
    expect(items()).toHaveLength(0)

    // If the timer weren't cancelled, this would try to filter an id that's
    // already gone — harmless either way, but proves no leftover timer fires.
    vi.advanceTimersByTime(10_000)
    expect(items()).toHaveLength(0)
  })
})
