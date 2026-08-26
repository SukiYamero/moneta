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

// The WAI-ARIA APG radio-group pattern, not a list of buttons.
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
