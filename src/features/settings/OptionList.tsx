import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRovingRadioGroup } from '@/components/shared/useRovingRadioGroup'

export interface OptionListItem<T extends string> {
  value: T
  label: string
}

export interface OptionListProps<T extends string> {
  items: OptionListItem<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
}

export const OptionList = <T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
}: OptionListProps<T>) => {
  const { buttonRefs, selectedIndex, handleKeyDown } = useRovingRadioGroup(
    items,
    value,
    onChange,
    'vertical',
  )

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-card p-1"
    >
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            aria-checked={selected}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-colors',
              selected ? 'bg-secondary text-foreground' : 'text-fg-secondary hover:text-foreground',
            )}
          >
            {item.label}
            {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
