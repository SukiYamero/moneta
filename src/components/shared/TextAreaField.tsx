import { useId, type ComponentProps, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface TextAreaFieldProps extends Omit<
  ComponentProps<'textarea'>,
  'id' | 'onChange' | 'value'
> {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  id?: string
  containerClassName?: string
  ref?: Ref<HTMLTextAreaElement>
}

const COUNTER_THRESHOLD_RATIO = 0.75

export const TextAreaField = ({
  label,
  value,
  onChange,
  error,
  id,
  containerClassName,
  className,
  ref,
  maxLength,
  rows = 2,
  ...props
}: TextAreaFieldProps) => {
  const { t } = useTranslation('common')
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const counterId = `${inputId}-counter`
  const showCounter = maxLength !== undefined && value.length >= maxLength * COUNTER_THRESHOLD_RATIO
  const describedBy =
    [showCounter ? counterId : undefined, error !== undefined ? errorId : undefined]
      .filter((part) => part !== undefined)
      .join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <Label htmlFor={inputId}>{label}</Label>
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-11 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...props}
      />
      {maxLength !== undefined && (
        <p id={counterId} className="min-h-4 text-right text-sm text-fg-tertiary">
          {showCounter && t('characterCount', { count: value.length, max: maxLength })}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
