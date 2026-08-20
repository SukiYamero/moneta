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

/** Steps from `from` in `delta` direction, wrapping, skipping disabled options. `null` if every option is disabled. */
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

/**
 * The APG "radio group" keyboard/focus contract (one tab stop, arrow keys
 * move focus and selection together) — shared so it exists in exactly one
 * place instead of being copied per `role="radiogroup"` component
 * (`SegmentedControl` and `OptionList` both implemented this pattern
 * separately, and only one of them actually had the roving `tabIndex`/
 * arrow-key handling the role promises; specs.md §12, 2026-08-20).
 * `orientation` picks the arrow-key pair per the APG spec: Left/Right for a
 * horizontal layout, Up/Down for a vertical one.
 */
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
