export type Hlc = string

const RADIX = 36
const MILLIS_WIDTH = 9
const COUNTER_WIDTH = 4

const encode = (millis: number, counter: number, device: string): Hlc =>
  `${millis.toString(RADIX).padStart(MILLIS_WIDTH, '0')}-${counter
    .toString(RADIX)
    .padStart(COUNTER_WIDTH, '0')}-${device}`

const decode = (hlc: Hlc): { millis: number; counter: number } => {
  const [millisPart, counterPart] = hlc.split('-')
  return {
    millis: Number.parseInt(millisPart ?? '0', RADIX),
    counter: Number.parseInt(counterPart ?? '0', RADIX),
  }
}

export interface LogicalClock {
  tick: () => Hlc
  observe: (remote: Hlc) => void
  clampToServer: (serverNow: number, toleranceMs?: number) => void
}

const DEFAULT_CLAMP_TOLERANCE_MS = 5 * 60_000

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
