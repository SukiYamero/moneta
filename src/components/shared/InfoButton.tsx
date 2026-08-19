import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InfoButtonProps {
  onClick: () => void
  /** Defaults to a generic label; pass a specific one when several InfoButtons share a screen. */
  label?: string
  className?: string
}

/** The small "?" affordance that opens an info tooltip (CenterModal owned by the caller). */
export function InfoButton({ onClick, label = 'Más información', className }: InfoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex min-h-11 min-w-11 shrink-0 items-center justify-center text-info',
        className,
      )}
    >
      <Info className="size-4.5" aria-hidden="true" />
    </button>
  )
}
