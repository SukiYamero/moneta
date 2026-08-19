import { useId, type Ref } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AmountSeparators {
  decimal: string
  group: string
}

// Locale grouping/decimal characters vary (es-CO groups "." and decimals
// with ",", en-US is the reverse) and change with the copy locale, so they
// are read from Intl per locale rather than assumed — the amount field's
// whole reason to exist per specs.md §10.14 ("never a hand-rolled parser").
const separatorsFor = (locale: string): AmountSeparators => {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5)
  return {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
  }
}

/**
 * Parses a raw amount string typed under `locale`'s grouping/decimal
 * convention into `Movimiento.monto` (always positive — sign comes from
 * `tipo`, schema.ts). Returns `undefined` for empty, negative, or
 * malformed input rather than `NaN`, so callers can treat "no value yet"
 * and "invalid value" as the same not-a-number case.
 */
export const parseAmount = (raw: string, locale: string): number | undefined => {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined

  const { decimal, group } = separatorsFor(locale)
  const normalized = trimmed.split(group).join('').replace(decimal, '.')
  const value = Number(normalized)

  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/** The inverse of `parseAmount` — formats a stored amount for the input under `locale`, e.g. to prefill an edit form. */
export const formatAmountForInput = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)

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
 * rule, e.g. "amount required") and when the typed text doesn't parse
 * under `locale` at all — the second case needs no copy from the caller,
 * since this component is the one place that knows what "doesn't parse"
 * means; `error`'s text is what renders, malformed-but-no-`error` is
 * flagged without a message.
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
  const isMalformed = value.trim() !== '' && parseAmount(value, locale) === undefined
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
