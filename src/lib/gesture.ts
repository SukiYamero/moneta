export interface VelocityTracker {
  record: (position: number, time: number) => void
  /** `atTime` (typically the release event's own timestamp) zeroes out a stale
   * reading when the finger stopped moving and paused before release. */
  velocity: (atTime?: number) => number
  reset: () => void
}

const VELOCITY_WINDOW_MS = 60
// Below this, elapsed time is dominated by event-loop/dispatch jitter rather than
// real gesture motion, and a distance/time division blows up into noise.
const MIN_ELAPSED_MS = 8

export const createVelocityTracker = (windowMs: number = VELOCITY_WINDOW_MS): VelocityTracker => {
  let samples: { position: number; time: number }[] = []

  return {
    record(position, time) {
      samples = [...samples, { position, time }].filter((sample) => time - sample.time <= windowMs)
    },
    velocity(atTime) {
      if (samples.length < 2) return 0
      const first = samples[0]!
      const last = samples.at(-1)!
      if (atTime !== undefined && atTime - last.time > windowMs) return 0
      const elapsed = last.time - first.time
      return elapsed >= MIN_ELAPSED_MS ? (last.position - first.position) / elapsed : 0
    },
    reset() {
      samples = []
    },
  }
}

export interface SwipeCommitOptions {
  distance: number
  velocity: number
  distanceThreshold: number
  velocityThreshold: number
}

export const shouldCommitSwipe = ({
  distance,
  velocity,
  distanceThreshold,
  velocityThreshold,
}: SwipeCommitOptions): boolean =>
  Math.abs(distance) >= distanceThreshold || Math.abs(velocity) >= velocityThreshold

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Walks up from `node` to find the nearest ancestor a browser would natively scroll —
 * the manual-scroll target for an element whose own `touch-action: none` opts it out of
 * native panning so it can resolve horizontal-vs-vertical gestures without a race. */
export const findScrollableAncestor = (node: HTMLElement | null): HTMLElement | null => {
  let el = node?.parentElement ?? null
  while (el) {
    if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el
    el = el.parentElement
  }
  return null
}
