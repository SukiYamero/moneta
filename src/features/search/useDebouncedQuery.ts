import { useEffect, useState } from 'react'

const DEFAULT_DEBOUNCE_MS = 250

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
