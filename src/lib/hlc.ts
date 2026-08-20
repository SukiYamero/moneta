// hlc.ts — a hybrid logical clock for ordering local operations.
//
// specs.md §10.19: the Drive op log needs a total order that every device
// computes identically, which wall-clock timestamps cannot guarantee (two
// devices' clocks disagree). A hybrid logical clock is device-local physical
// time paired with a counter that only ever advances, so a burst of ticks in
// the same millisecond — or a backward jump in the system clock — still
// yields a strictly increasing sequence.
//
// `observe`/`clampToServer` are the "hybrid" half this file originally left
// for "whoever builds replay/pull" (Track Z, this file's first consumer) —
// filled in here, not rebuilt: `tick`'s own algorithm and `Hlc`'s encoding
// are untouched. Why it turned out not to be optional: two independent
// per-device clocks (`createLogicalClock` called once per device, each
// ticking from its own `Date.now()`) have **no guaranteed relative order**
// on their own — device B's `tick()` half a second after device A's isn't
// guaranteed to sort after it, since B never learned anything about A's
// clock. That breaks the one property `basedOn` chains depend on: an op
// that claims `basedOn: X` must sort *after* X. `observe(remote)` is what
// makes that true — call it whenever this device learns of a remote hlc (a
// downloaded op during pull, per specs.md §10.19's "How we know...") so the
// *next* local tick is guaranteed greater. `clampToServer` is the matching
// half for a poisoned local clock (specs.md §10.19: "a device whose clock
// claims 2099 can be clamped"): without it, one bad `Date.now()` reading
// makes `lastMillis` permanently stuck in the future, since physical time
// can never lap it again.

export type Hlc = string

const RADIX = 36
const MILLIS_WIDTH = 9 // 36^9 ms ≈ 366,000 years of headroom
const COUNTER_WIDTH = 4 // 36^4 ≈ 1.68M ticks in the same millisecond

const encode = (millis: number, counter: number, device: string): Hlc =>
  `${millis.toString(RADIX).padStart(MILLIS_WIDTH, '0')}-${counter
    .toString(RADIX)
    .padStart(COUNTER_WIDTH, '0')}-${device}`

// The inverse of `encode`'s first two segments — device is never decoded
// back out, callers that need it already have it from the entry that
// carried this hlc (opLog.ts never needs to split an hlc apart to find out
// whose it was).
const decode = (hlc: Hlc): { millis: number; counter: number } => {
  const [millisPart, counterPart] = hlc.split('-')
  return {
    millis: Number.parseInt(millisPart ?? '0', RADIX),
    counter: Number.parseInt(counterPart ?? '0', RADIX),
  }
}

export interface LogicalClock {
  /** Produces the next Hlc for this device, strictly greater than every prior one it has issued or observed. */
  tick: () => Hlc
  /**
   * Folds in an hlc this device just learned about (typically a downloaded
   * op during a pull) so every future `tick()` sorts after it — the
   * standard HLC merge step (`lastMillis' = max(lastMillis, remote.millis)`,
   * counter carried or reset to match). A no-op when `remote` is already
   * behind this clock's own state; never moves the clock *backward*.
   */
  observe: (remote: Hlc) => void
  /**
   * Clamps a runaway local clock against a trusted external time (Drive's
   * response `Date` header — reachable from a browser fetch, verified
   * empirically: `Access-Control-Expose-Headers` on `googleapis.com`
   * responses includes `date`). Only ever pulls `lastMillis` *down* to
   * `serverNow` when it is implausibly ahead (past `toleranceMs`); a local
   * clock that is merely fast/slow by a reasonable amount is left alone —
   * this is a sanity backstop for a badly wrong clock, not a resync on
   * every request.
   */
  clampToServer: (serverNow: number, toleranceMs?: number) => void
}

const DEFAULT_CLAMP_TOLERANCE_MS = 5 * 60_000 // 5 minutes of drift is normal; a poisoned clock is off by far more.

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

  const observe = (remote: Hlc): void => {
    const { millis, counter: remoteCounter } = decode(remote)
    if (millis > lastMillis) {
      lastMillis = millis
      counter = remoteCounter
    } else if (millis === lastMillis && remoteCounter > counter) {
      counter = remoteCounter
    }
    // millis < lastMillis: remote is behind this clock already, nothing to fold in.
  }

  const clampToServer = (
    serverNow: number,
    toleranceMs: number = DEFAULT_CLAMP_TOLERANCE_MS,
  ): void => {
    if (lastMillis > serverNow + toleranceMs) {
      lastMillis = serverNow
      counter = 0
    }
  }

  return { tick, observe, clampToServer }
}
