import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
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

/**
 * Generic pill-group toggle (history scope, gasto/ingreso, tag-breakdown
 * tabs, number-format prefs…) — no screen-specific assumptions baked in.
 * Follows the APG "radio group" pattern: one tab stop, arrow keys move
 * focus and selection together.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isArrowKey(event.key)) return
    event.preventDefault()
    const delta = ARROW_DELTA[event.key]
    const nextIndex = (selectedIndex + delta + options.length) % options.length
    const next = options[nextIndex]
    if (!next) return
    onChange(next.value)
    ;(
      event.currentTarget.parentElement?.children[nextIndex] as HTMLButtonElement | undefined
    )?.focus()
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
            aria-checked={selected}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'min-h-9 flex-1 rounded-md px-1 py-2 text-ms font-bold whitespace-nowrap transition-colors',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-fg-tertiary hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
