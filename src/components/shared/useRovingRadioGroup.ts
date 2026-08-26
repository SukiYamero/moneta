import { useRef, type KeyboardEvent, type RefObject } from 'react'

export type RovingRadioGroupOrientation = 'horizontal' | 'vertical'

const ARROW_KEYS_FOR_ORIENTATION: Record<
  RovingRadioGroupOrientation,
  { prev: string; next: string }
> = {
  horizontal: { prev: 'ArrowLeft', next: 'ArrowRight' },
  vertical: { prev: 'ArrowUp', next: 'ArrowDown' },
}

interface RovingRadioGroupOption<T extends string> {
  value: T
  disabled?: boolean
}

const findNextEnabledIndex = <T extends string>(
  options: RovingRadioGroupOption<T>[],
  from: number,
  delta: number,
): number | null => {
  const count = options.length
  for (let step = 1; step <= count; step++) {
    const index = (((from + delta * step) % count) + count) % count
    if (!options[index]?.disabled) return index
  }
  return null
}

export interface UseRovingRadioGroupResult {
  buttonRefs: RefObject<(HTMLButtonElement | null)[]>
  selectedIndex: number
  handleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

// The WAI-ARIA APG radio-group keyboard contract: one tab stop, arrow keys
// move focus and selection together, wrapping past the ends.
export const useRovingRadioGroup = <T extends string>(
  options: RovingRadioGroupOption<T>[],
  value: T,
  onChange: (value: T) => void,
  orientation: RovingRadioGroupOrientation,
): UseRovingRadioGroupResult => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const { prev, next } = ARROW_KEYS_FOR_ORIENTATION[orientation]

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === next ? 1 : event.key === prev ? -1 : null
    if (delta === null) return
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(options, selectedIndex, delta)
    if (nextIndex === null) return
    const nextOption = options[nextIndex]
    if (!nextOption) return
    onChange(nextOption.value)
    buttonRefs.current[nextIndex]?.focus()
  }

  return { buttonRefs, selectedIndex, handleKeyDown }
}
