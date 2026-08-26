import type { Ref } from 'react'
import { cn } from '@/lib/utils'

export interface ToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

export const Toggle = ({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  className,
  ref,
}: ToggleProps) => {
  return (
    <button
      type="button"
      ref={ref}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex min-h-11 min-w-11 shrink-0 items-center justify-center disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'relative h-6.25 w-10.5 rounded-3xl transition-colors',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5.25 rounded-full transition-[left]',
            checked ? 'left-4.75 bg-primary-foreground' : 'left-0.5 bg-fg-faint',
          )}
        />
      </span>
    </button>
  )
}
