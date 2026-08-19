import { useEffect, useState } from 'react'

const DEFAULT_DEBOUNCE_MS = 250

/**
 * Debounces a search query for filtering, but never delays *clearing* it —
 * an empty query commits immediately. Without that, hitting "clear" would
 * leave the previous, now-stale filtered results on screen for the rest of
 * the debounce window: a stranded result set the caller never asked to see.
 */
export const useDebouncedQuery = (query: string, delayMs: number = DEFAULT_DEBOUNCE_MS): string => {
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    if (query === '') {
      setDebounced('')
      return
    }
    const timeout = setTimeout(() => setDebounced(query), delayMs)
    return () => clearTimeout(timeout)
  }, [query, delayMs])

  return debounced
}
