import { useEffect, useRef, useState } from 'react'

const DEFAULT_DELAY_MS = 150
const DEFAULT_MIN_VISIBLE_MS = 350

export interface UsePendingDelayOptions {
  delayMs?: number
  minVisibleMs?: number
}

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
