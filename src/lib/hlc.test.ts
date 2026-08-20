import { describe, expect, it } from 'vitest'
import { createLogicalClock } from '@/lib/hlc'

describe('createLogicalClock', () => {
  it('advances the millis segment when physical time moves forward', () => {
    let now = 1_000
    const clock = createLogicalClock('dev1', () => now)

    const first = clock.tick()
    now = 2_000
    const second = clock.tick()

    expect(first < second).toBe(true)
  })

  it('advances the counter, not the millis, for two ticks in the same millisecond', () => {
    const clock = createLogicalClock('dev1', () => 5_000)

    const first = clock.tick()
    const second = clock.tick()

    expect(first < second).toBe(true)
    // Same millis segment both times — only the counter moved.
    expect(first.split('-')[0]).toBe(second.split('-')[0])
    expect(first.split('-')[1]).not.toBe(second.split('-')[1])
  })

  it('stays strictly increasing even if the system clock jumps backward', () => {
    let now = 10_000
    const clock = createLogicalClock('dev1', () => now)

    const first = clock.tick()
    now = 1_000 // backward jump
    const second = clock.tick()
    const third = clock.tick()

    expect(first < second).toBe(true)
    expect(second < third).toBe(true)
  })

  it('is independent per clock instance (no shared module state)', () => {
    const a = createLogicalClock('dev-a', () => 1_000)
    const b = createLogicalClock('dev-b', () => 1_000)

    const tickA = a.tick()
    const tickB = b.tick()

    // Same millis/counter, tie-broken by device id.
    expect(tickA.split('-')[0]).toBe(tickB.split('-')[0])
    expect(tickA.split('-')[1]).toBe(tickB.split('-')[1])
    expect(tickA < tickB).toBe(true) // 'dev-a' < 'dev-b'
  })

  it('produces a total order identical to plain string comparison across many ticks', () => {
    let now = 0
    const clock = createLogicalClock('dev1', () => {
      now += Math.floor(Math.random() * 3) // 0, 1, or 2 ms steps, including repeats
      return now
    })

    const ticks = Array.from({ length: 200 }, () => clock.tick())
    const sorted = [...ticks].toSorted()

    expect(ticks).toEqual(sorted)
  })
})
