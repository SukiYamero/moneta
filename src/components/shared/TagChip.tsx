import type { LucideIcon } from 'lucide-react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { TINT_CLASSES } from '@/components/shared/tintClasses'

export interface TagChipProps {
  icon: LucideIcon
  label: string
  /**
   * The category's color family (`movimientoView.getMovimientoVisual`'s
   * `tint`, or its type-based fallback) — TagChip only paints it, it never
   * maps a category to a color itself. Required, not defaulted: a call
   * site that forgets to pass it is a compile error rather than silently
   * rendering the old uniform-primary look.
   */
  tint: IconAvatarTint
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
 * inflate the pill. The icon always carries the category's tint; selecting
 * tints the whole pill in that same family, replacing the old uniform
 * `primary` treatment.
 */
export const TagChip = ({
  icon: Icon,
  label,
  tint,
  selected = false,
  disabled = false,
  onClick,
  className,
  ref,
}: TagChipProps) => {
  const tintClasses = TINT_CLASSES[tint]
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
            ? tintClasses.pill
            : 'border-border-subtle bg-secondary text-fg-secondary group-hover:border-border-hover',
        )}
      >
        <Icon className={cn('size-3.5', tintClasses.icon)} aria-hidden="true" />
        {label}
      </span>
    </button>
  )
}
