import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

// jsdom (the test environment) has no matchMedia, and it's plausible on a
// very old browser too — the global CSS override in index.css handles
// every CSS transition/animation regardless, so this guard only needs to
// cover recharts' JS-driven bar animation degrading gracefully to "not
// reduced" rather than throwing.
const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

const subscribe = (callback: () => void): (() => void) => {
  if (!supportsMatchMedia()) return () => {}
  const mediaQueryList = window.matchMedia(QUERY)
  mediaQueryList.addEventListener('change', callback)
  return () => mediaQueryList.removeEventListener('change', callback)
}

const getSnapshot = (): boolean => (supportsMatchMedia() ? window.matchMedia(QUERY).matches : false)

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false)
