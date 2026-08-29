import { create } from 'zustand'

export const SINGLE_TAB_LOCK_NAME = 'kurobello-single-tab'

const GRACE_PERIOD_MS = 280

export type SingleTabGuardPhase = 'checking' | 'granted' | 'blocked' | 'unsupported'

const isWebLocksSupported = (): boolean =>
  typeof navigator !== 'undefined' && navigator.locks != null

const requestLock = (): Promise<'granted' | 'unavailable'> =>
  new Promise((resolve) => {
    void navigator.locks.request(
      SINGLE_TAB_LOCK_NAME,
      { mode: 'exclusive', ifAvailable: true },
      (lock) => {
        if (!lock) {
          resolve('unavailable')
          return Promise.resolve()
        }
        resolve('granted')
        return new Promise<void>(() => {})
      },
    )
  })

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface SingleTabGuardState {
  phase: SingleTabGuardPhase
  init: () => Promise<void>
  retry: () => Promise<void>
}

let attemptInFlight = false

const attempt = async (set: (partial: Partial<SingleTabGuardState>) => void): Promise<void> => {
  attemptInFlight = true
  set({ phase: 'checking' })
  try {
    const first = await requestLock()
    if (first === 'granted') {
      set({ phase: 'granted' })
      return
    }
    await delay(GRACE_PERIOD_MS)
    const second = await requestLock()
    set({ phase: second === 'granted' ? 'granted' : 'blocked' })
  } finally {
    attemptInFlight = false
  }
}

export const useSingleTabGuardStore = create<SingleTabGuardState>((set, get) => ({
  phase: isWebLocksSupported() ? 'checking' : 'unsupported',
  init: () => {
    if (!isWebLocksSupported() || attemptInFlight || get().phase === 'granted')
      return Promise.resolve()
    return attempt(set)
  },
  retry: () => {
    if (!isWebLocksSupported() || attemptInFlight) return Promise.resolve()
    return attempt(set)
  },
}))
