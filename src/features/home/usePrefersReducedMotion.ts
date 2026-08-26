import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

// jsdom has no matchMedia; also plausible on very old browsers.
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
