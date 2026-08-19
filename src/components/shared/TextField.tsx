import { useId, type ComponentProps, type Ref } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (value: string) => void
  /** Rendered below the field as a `role="alert"` node, wired via `aria-describedby`. */
  error?: string
  id?: string
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * Labelled text input: label association via `htmlFor`/`id`, an
 * `aria-describedby` error message, and a 44px touch target — the a11y
 * this component exists for (`specs.md` §10.14).
 */
export const TextField = ({
  label,
  value,
  onChange,
  error,
  id,
  containerClassName,
  className,
  ref,
  ...props
}: TextFieldProps) => {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className={cn('min-h-11 text-base', className)}
        {...props}
      />
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
