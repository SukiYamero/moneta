// hlc.ts — a hybrid logical clock for ordering local operations.
//
// specs.md §10.19: the Drive op log needs a total order that every device
// computes identically, which wall-clock timestamps cannot guarantee (two
// devices' clocks disagree). A hybrid logical clock is device-local physical
// time paired with a counter that only ever advances, so a burst of ticks in
// the same millisecond — or a backward jump in the system clock — still
// yields a strictly increasing sequence. Purely local: this module never
// looks at another device's clock. The "hybrid" half that reconciles against
// a *remote* clock value (folding in what a downloaded op claims, clamping
// against Drive's server `Date` header) belongs to whoever builds replay/pull
// — this device only ever writes its own file (§10.19: "exactly one device
// ever writes any given file"), so it never needs to advance past a value it
// didn't itself produce.

export type Hlc = string

const RADIX = 36
const MILLIS_WIDTH = 9 // 36^9 ms ≈ 366,000 years of headroom
const COUNTER_WIDTH = 4 // 36^4 ≈ 1.68M ticks in the same millisecond

const encode = (millis: number, counter: number, device: string): Hlc =>
  `${millis.toString(RADIX).padStart(MILLIS_WIDTH, '0')}-${counter
    .toString(RADIX)
    .padStart(COUNTER_WIDTH, '0')}-${device}`

export interface LogicalClock {
  /** Produces the next Hlc for this device, strictly greater than every prior one it has issued. */
  tick: () => Hlc
}

// Zero-padded, fixed-width, lowercase-base36 segments joined by `-` sort
// identically as plain strings and as the (millis, counter, device) triple
// they encode — so ordering two ops is `a.hlc < b.hlc`, no parsing required.
export const createLogicalClock = (device: string, now: () => number = Date.now): LogicalClock => {
  let lastMillis = 0
  let counter = 0

  const tick = (): Hlc => {
    const physical = now()
    if (physical > lastMillis) {
      lastMillis = physical
      counter = 0
    } else {
      counter += 1
    }
    return encode(lastMillis, counter, device)
  }

  return { tick }
}
