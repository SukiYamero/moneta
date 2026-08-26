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
    expect(first.split('-')[0]).toBe(second.split('-')[0])
    expect(first.split('-')[1]).not.toBe(second.split('-')[1])
  })

  it('stays strictly increasing even if the system clock jumps backward', () => {
    let now = 10_000
    const clock = createLogicalClock('dev1', () => now)

    const first = clock.tick()
    now = 1_000
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

    expect(tickA.split('-')[0]).toBe(tickB.split('-')[0])
    expect(tickA.split('-')[1]).toBe(tickB.split('-')[1])
    expect(tickA < tickB).toBe(true)
  })

  it('produces a total order identical to plain string comparison across many ticks', () => {
    let now = 0
    const clock = createLogicalClock('dev1', () => {
      now += Math.floor(Math.random() * 3)
      return now
    })

    const ticks = Array.from({ length: 200 }, () => clock.tick())
    const sorted = [...ticks].toSorted()

    expect(ticks).toEqual(sorted)
  })
})

describe('observe', () => {
  it('makes the next tick sort after a remote hlc that is ahead of this clock', () => {
    const remoteClock = createLogicalClock('remote', () => 50_000)
    const remote = remoteClock.tick()

    const local = createLogicalClock('local', () => 1_000)
    local.observe(remote)
    const next = local.tick()

    expect(next > remote).toBe(true)
  })

  it('carries the remote counter forward when millis match exactly', () => {
    const remote = createLogicalClock('remote', () => 5_000)
    remote.tick()
    const remoteSecond = remote.tick()

    const local = createLogicalClock('local', () => 5_000)
    local.observe(remoteSecond)
    const next = local.tick()

    expect(next > remoteSecond).toBe(true)
    expect(next.split('-')[0]).toBe(remoteSecond.split('-')[0])
  })

  it('is a no-op when the remote hlc is already behind this clock', () => {
    const local = createLogicalClock('local', () => 90_000)
    const ahead = local.tick()

    const behindRemote = createLogicalClock('remote', () => 1_000).tick()
    local.observe(behindRemote)
    const next = local.tick()

    expect(next > ahead).toBe(true)
    expect(next.split('-')[0]).toBe(ahead.split('-')[0])
  })
})

describe('clampToServer', () => {
  it('pulls a runaway local clock down to server time so a later, sane reading is not forced to append onto the poisoned base', () => {
    let reading = 10_000_000_000
    const clock = createLogicalClock('dev1', () => reading)
    clock.tick()

    clock.clampToServer(1_000)
    reading = 2_000

    const next = clock.tick()
    const decodedMillis = Number.parseInt(next.split('-')[0] ?? '0', 36)
    expect(decodedMillis).toBe(2_000)
  })

  it('leaves the clock alone when it is only off by a normal amount of drift', () => {
    const clock = createLogicalClock('dev1', () => 100_000)
    const before = clock.tick()

    clock.clampToServer(99_000)
    const after = clock.tick()

    expect(after > before).toBe(true)
    expect(after.split('-')[0]).toBe(before.split('-')[0])
  })
})
