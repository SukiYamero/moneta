import { Info } from 'lucide-react'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'

export interface InfoButtonProps {
  onClick: () => void
  label?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

export const InfoButton = ({
  onClick,
  label = 'Más información',
  className,
  ref,
}: InfoButtonProps) => {
  return (
    <button
      type="button"
      ref={ref}
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
