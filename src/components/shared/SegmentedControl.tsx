import { cn } from '@/lib/utils'
import { useRovingRadioGroup } from '@/components/shared/useRovingRadioGroup'

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

/**
 * Generic pill-group toggle (history scope, gasto/ingreso, tag-breakdown
 * tabs, number-format prefs…) — no screen-specific assumptions baked in.
 * Follows the APG "radio group" pattern: one tab stop, arrow keys move
 * focus and selection together. The visible pill keeps its designed
 * height; each segment's button grows to the 44px touch-target floor via
 * invisible padding so the tap target doesn't inflate the pill.
 */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) => {
  const { buttonRefs, selectedIndex, handleKeyDown } = useRovingRadioGroup(
    options,
    value,
    onChange,
    'horizontal',
  )

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
