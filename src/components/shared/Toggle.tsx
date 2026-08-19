import { cn } from '@/lib/utils'

export interface ToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Required when no visible text labels the switch (e.g. used standalone in a settings row, pass the row's label). */
  'aria-label'?: string
  className?: string
}

/** On/off switch. Touch target is 44px even though the visual pill is smaller, per AGENTS.md. */
export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
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
          'relative h-[25px] w-[42px] rounded-3xl transition-colors',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-[21px] rounded-full transition-[left]',
            checked ? 'left-[19px] bg-primary-foreground' : 'left-0.5 bg-fg-faint',
          )}
        />
      </span>
    </button>
  )
}
