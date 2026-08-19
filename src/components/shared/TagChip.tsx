import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TagChipProps {
  icon: LucideIcon
  label: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

/** Icon + name pill, used for category/tag selection everywhere (Add sheet, Filter sheet, Tag picker…). */
export function TagChip({ icon: Icon, label, selected = false, onClick, className }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-ms font-semibold whitespace-nowrap transition-colors',
        selected
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border-subtle bg-secondary text-fg-secondary hover:border-border-hover',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}
