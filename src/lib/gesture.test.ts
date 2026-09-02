import { describe, expect, it } from 'vitest'
import { createVelocityTracker, prefersReducedMotion, shouldCommitSwipe } from '@/lib/gesture'

describe('createVelocityTracker', () => {
  it('reports zero velocity with fewer than two samples', () => {
    const tracker = createVelocityTracker()
    expect(tracker.velocity()).toBe(0)
    tracker.record(0, 0)
    expect(tracker.velocity()).toBe(0)
  })

  it('computes signed px/ms velocity across recorded samples', () => {
    const tracker = createVelocityTracker()
    tracker.record(0, 0)
    tracker.record(50, 50)
    expect(tracker.velocity()).toBe(1)
  })

  it('computes a negative velocity for movement toward lower positions', () => {
    const tracker = createVelocityTracker()
    tracker.record(100, 0)
    tracker.record(0, 25)
    expect(tracker.velocity()).toBe(-4)
  })

  it('drops samples older than the tracking window, keeping only the recent flick', () => {
    const tracker = createVelocityTracker(60)
    tracker.record(0, 0)
    tracker.record(5, 10)
    tracker.record(100, 70)
    expect(tracker.velocity()).toBe((100 - 5) / (70 - 10))
  })

  it('ignores samples too close together in time to trust, rather than dividing by near-zero', () => {
    const tracker = createVelocityTracker()
    tracker.record(0, 0)
    tracker.record(50, 2)
    expect(tracker.velocity()).toBe(0)
  })

  it('resets to reporting zero velocity after reset()', () => {
    const tracker = createVelocityTracker()
    tracker.record(0, 0)
    tracker.record(100, 100)
    tracker.reset()
    expect(tracker.velocity()).toBe(0)
  })
})

describe('shouldCommitSwipe', () => {
  const base = { distanceThreshold: 40, velocityThreshold: 0.5 }

  it.each([
    { distance: 50, velocity: 0, expected: true, label: 'distance alone clears the threshold' },
    { distance: -50, velocity: 0, expected: true, label: 'negative distance alone clears it' },
    { distance: 10, velocity: 0.6, expected: true, label: 'velocity alone clears the threshold' },
    { distance: 10, velocity: -0.6, expected: true, label: 'negative velocity alone clears it' },
    {
      distance: 10,
      velocity: 0.1,
      expected: false,
      label: 'neither distance nor velocity clears it',
    },
    {
      distance: 40,
      velocity: 0,
      expected: true,
      label: 'distance exactly at the threshold commits',
    },
    {
      distance: 10,
      velocity: 0.5,
      expected: true,
      label: 'velocity exactly at the threshold commits',
    },
  ])('$label', ({ distance, velocity, expected }) => {
    expect(shouldCommitSwipe({ ...base, distance, velocity })).toBe(expected)
  })
})

describe('prefersReducedMotion', () => {
  it('reflects matchMedia for the reduced-motion query', () => {
    const originalMatchMedia = globalThis.matchMedia
    globalThis.matchMedia = ((query: string) =>
      ({ matches: query.includes('reduce') }) as MediaQueryList) as typeof matchMedia

    expect(prefersReducedMotion()).toBe(true)

    globalThis.matchMedia = originalMatchMedia
  })
})
