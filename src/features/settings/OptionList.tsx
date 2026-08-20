import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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

/**
 * A vertical single-select list — `SegmentedControl`'s horizontal pill row
 * doesn't fit here: idioma (5 options incl. "seguir el dispositivo") and
 * moneda (6 options) both need to read as a scannable vertical list, the
 * same layout `YearMenu.tsx`'s popover already uses for its own option rows
 * (a leading/trailing `Check`) — but as static, non-popover content, so
 * `/settings` shows both lists inline rather than behind a trigger. ARIA
 * semantics follow `SegmentedControl`'s `radiogroup`/`radio` pattern, not
 * `YearMenu`'s `listbox`/`option`: this is a persistent single-select
 * control, not a popup menu.
 */
export const OptionList = <T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
}: OptionListProps<T>) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-card p-1"
  >
    {items.map((item) => {
      const selected = item.value === value
      return (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(item.value)}
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
