import type { LucideIcon } from 'lucide-react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'

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

// Same chart-*/status tokens IconAvatar's TINT_CLASSES draws from, split
// into an always-on icon color and a selected-pill treatment (border + bg +
// text) — a pill needs a border IconAvatar's square badge doesn't, so this
// can't just reuse that table's strings, but it stays keyed on the same
// IconAvatarTint so a new tint is a compile error here too. `neutral` gets
// a visibly stronger border/bg/text than the unselected pill's own
// `border-border-subtle`/`bg-secondary`/`text-fg-secondary`, since a tint
// identical to "no tint" would make a selected neutral chip unreadable as
// selected.
const TAG_TINT_CLASSES: Record<IconAvatarTint, { icon: string; selectedPill: string }> = {
  emerald: { icon: 'text-chart-1', selectedPill: 'border-chart-1/40 bg-chart-1/15 text-chart-1' },
  blue: { icon: 'text-chart-2', selectedPill: 'border-chart-2/40 bg-chart-2/15 text-chart-2' },
  purple: { icon: 'text-chart-5', selectedPill: 'border-chart-5/40 bg-chart-5/15 text-chart-5' },
  rose: { icon: 'text-chart-4', selectedPill: 'border-chart-4/40 bg-chart-4/15 text-chart-4' },
  amber: { icon: 'text-chart-3', selectedPill: 'border-chart-3/40 bg-chart-3/15 text-chart-3' },
  success: { icon: 'text-success', selectedPill: 'border-success/40 bg-success/15 text-success' },
  danger: { icon: 'text-danger', selectedPill: 'border-danger/40 bg-danger/15 text-danger' },
  info: { icon: 'text-info', selectedPill: 'border-info/40 bg-info/15 text-info' },
  neutral: {
    icon: 'text-muted-foreground',
    selectedPill: 'border-border-strong bg-muted text-foreground',
  },
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
  const tintClasses = TAG_TINT_CLASSES[tint]
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
            ? tintClasses.selectedPill
            : 'border-border-subtle bg-secondary text-fg-secondary group-hover:border-border-hover',
        )}
      >
        <Icon className={cn('size-3.5', tintClasses.icon)} aria-hidden="true" />
        {label}
      </span>
    </button>
  )
}
