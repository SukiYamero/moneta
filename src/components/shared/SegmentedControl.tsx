import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
  className?: string
}

type ArrowKey = 'ArrowLeft' | 'ArrowRight'

const ARROW_DELTA: Record<ArrowKey, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
}

function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowLeft' || key === 'ArrowRight'
}

/** Steps from `from` in `delta` direction, wrapping, skipping disabled options. `null` if every option is disabled. */
function findNextEnabledIndex<T extends string>(
  options: SegmentedControlOption<T>[],
  from: number,
  delta: number,
): number | null {
  const count = options.length
  for (let step = 1; step <= count; step++) {
    const index = (((from + delta * step) % count) + count) % count
    if (!options[index]?.disabled) return index
  }
  return null
}

/**
 * Generic pill-group toggle (history scope, gasto/ingreso, tag-breakdown
 * tabs, number-format prefs…) — no screen-specific assumptions baked in.
 * Follows the APG "radio group" pattern: one tab stop, arrow keys move
 * focus and selection together. The visible pill keeps its designed
 * height; each segment's button grows to the 44px touch-target floor via
 * invisible padding so the tap target doesn't inflate the pill.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isArrowKey(event.key)) return
    event.preventDefault()
    const delta = ARROW_DELTA[event.key]
    const nextIndex = findNextEnabledIndex(options, selectedIndex, delta)
    if (nextIndex === null) return
    const next = options[nextIndex]
    if (!next) return
    onChange(next.value)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex gap-1 rounded-lg bg-surface-sunken p-1', className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className="group flex min-h-11 flex-1 items-center justify-center disabled:opacity-50"
          >
            <span
              className={cn(
                'flex h-9 w-full items-center justify-center rounded-md px-1 text-ms font-bold whitespace-nowrap transition-colors',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-fg-tertiary group-hover:text-foreground',
              )}
            >
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
