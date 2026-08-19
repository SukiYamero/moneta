import { useEffect, useRef, useState } from 'react'

const DEFAULT_DELAY_MS = 150
const DEFAULT_MIN_VISIBLE_MS = 350

export interface UsePendingDelayOptions {
  /** How long `isPending` must hold true before the loader is allowed to appear. */
  delayMs?: number
  /** Once shown, the minimum time the loader stays visible — even if `isPending` resolves sooner. */
  minVisibleMs?: number
}

/**
 * The anti-flash gate every loading tier shares (specs.md §10.9): work that
 * finishes inside `delayMs` never shows a loader at all, and a loader that
 * did appear can't blink back out inside `minVisibleMs`. `shownAt` (not a
 * fixed timer) drives the hide delay, so a loader shown for 2s hides the
 * instant `isPending` clears instead of tacking on a pointless extra wait.
 */
export const usePendingDelay = (
  isPending: boolean,
  {
    delayMs = DEFAULT_DELAY_MS,
    minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
  }: UsePendingDelayOptions = {},
): boolean => {
  const [show, setShow] = useState(false)
  const shownAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (isPending) {
      if (show) return
      const timer = setTimeout(() => {
        shownAtRef.current = Date.now()
        setShow(true)
      }, delayMs)
      return () => clearTimeout(timer)
    }

    if (!show) return
    const elapsed = shownAtRef.current === null ? minVisibleMs : Date.now() - shownAtRef.current
    const remaining = Math.max(0, minVisibleMs - elapsed)
    const timer = setTimeout(() => {
      shownAtRef.current = null
      setShow(false)
    }, remaining)
    return () => clearTimeout(timer)
  }, [isPending, show, delayMs, minVisibleMs])

  return show
}
