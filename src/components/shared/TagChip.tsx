import type { LucideIcon } from 'lucide-react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { TINT_CLASSES } from '@/components/shared/tintClasses'

export interface TagChipProps {
  icon: LucideIcon
  label: string
  tint: IconAvatarTint
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  ref?: Ref<HTMLButtonElement>
}

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
