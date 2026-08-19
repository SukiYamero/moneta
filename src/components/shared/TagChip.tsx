import type { LucideIcon } from 'lucide-react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'

export interface TagChipProps {
  icon: LucideIcon
  label: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * Icon + name pill, used for category/tag selection everywhere (Add sheet,
 * Filter sheet, Tag picker…). The visible pill stays at its designed size;
 * the button itself grows to the 44px touch-target floor via invisible
 * padding (same split used by Toggle/InfoButton) so the tap target doesn't
 * inflate the pill.
 */
export const TagChip = ({
  icon: Icon,
  label,
  selected = false,
  disabled = false,
  onClick,
  className,
  ref,
}: TagChipProps) => {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group inline-flex min-h-11 shrink-0 items-center justify-center disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-ms font-semibold whitespace-nowrap transition-colors',
          selected
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-border-subtle bg-secondary text-fg-secondary group-hover:border-border-hover',
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
    </button>
  )
}
