import { useId, type Ref } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseAmountForInput } from '@/lib/i18n/amountFormat'
import { cn } from '@/lib/utils'

export interface AmountFieldProps {
  label: string
  /** The raw text as typed — the field stays a controlled string so a locale's grouping input round-trips, not a controlled number. */
  value: string
  onChange: (raw: string) => void
  /** BCP-47 tag from `useLocaleFormatting()`. Required, no default — a missed call site is a compile error, not a silent locale guess (`movimientoView.ts`'s convention). */
  locale: string
  error?: string
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * Locale-aware amount input. Not `type="number"`: native spinners, no
 * control over locale grouping, and `valueAsNumber` ignores the locale's
 * decimal separator entirely (`specs.md` §10.14). `inputMode="decimal"`
 * brings up the numeric keyboard on mobile without those constraints.
 *
 * `aria-invalid` is true both when the caller passes `error` (a business
 * rule, e.g. "amount required") and when the typed text is malformed under
 * `locale` — the second case needs no copy from the caller, since this
 * component is the one place that knows what "doesn't parse" means;
 * `error`'s text is what renders, malformed-but-no-`error` is flagged
 * without a message. Deliberately **not** flagged for `not_positive` (e.g.
 * a bare `0`): that is a valid keystroke on the way to `0,50`, not a typo,
 * and a caller with a business rule against it passes `error` explicitly
 * (`docs/error-handling.md`'s malformed/not_positive split, specs.md
 * §10.23 Decision 4).
 */
export const AmountField = ({
  label,
  value,
  onChange,
  locale,
  error,
  id,
  disabled,
  placeholder,
  className,
  containerClassName,
  ref,
}: AmountFieldProps) => {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const parsed = parseAmountForInput(value, locale)
  const isMalformed = !parsed.ok && parsed.reason === 'malformed'
  const invalid = error !== undefined || isMalformed

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid}
        aria-describedby={error !== undefined ? errorId : undefined}
        className={cn('min-h-11 text-base font-bold', className)}
      />
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
