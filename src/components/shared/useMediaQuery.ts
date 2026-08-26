import { useCallback, useSyncExternalStore } from 'react'

const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

// Degrades to false where matchMedia doesn't exist (jsdom, very old browsers).
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (callback: () => void): (() => void) => {
      if (!supportsMatchMedia()) return () => {}
      const mediaQueryList = window.matchMedia(query)
      mediaQueryList.addEventListener('change', callback)
      return () => mediaQueryList.removeEventListener('change', callback)
    },
    [query],
  )

  const getSnapshot = useCallback(
    (): boolean => (supportsMatchMedia() ? window.matchMedia(query).matches : false),
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
