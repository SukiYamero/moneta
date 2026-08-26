import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

type PadKey =
  | { kind: 'digit'; digit: number }
  | { kind: 'blank' }
  | { kind: 'delete' }
  | { kind: 'decimal' }

// 12 slots (3x4): digits 1-9, then a blank/decimal cell for grid alignment
// (blank for a caller with no decimal key, e.g. `PinPad`), then 0 and
// delete — never a submit button, every caller auto-advances or reads its
// own controlled `value` instead.
const buildKeys = (hasDecimal: boolean): PadKey[] => [
  { kind: 'digit', digit: 1 },
  { kind: 'digit', digit: 2 },
  { kind: 'digit', digit: 3 },
  { kind: 'digit', digit: 4 },
  { kind: 'digit', digit: 5 },
  { kind: 'digit', digit: 6 },
  { kind: 'digit', digit: 7 },
  { kind: 'digit', digit: 8 },
  { kind: 'digit', digit: 9 },
  hasDecimal ? { kind: 'decimal' } : { kind: 'blank' },
  { kind: 'digit', digit: 0 },
  { kind: 'delete' },
]

export interface NumericKeypadProps {
  onDigit: (digit: number) => void
  onDelete: () => void
  /** Renders the decimal-separator key in place of the blank cell — omit for a PIN-shaped pad with no decimal entry. */
  onDecimal?: () => void
  /** The separator character to show on the decimal key, e.g. locale's own `,`/`.` (`amountFormat.ts`'s `decimalSeparatorFor`) — never hardcoded here. */
  decimalLabel?: string
  decimalAriaLabel?: string
  deleteAriaLabel: string
  digitsDisabled?: boolean
  decimalDisabled?: boolean
  deleteDisabled?: boolean
  /** Disables every key, regardless of the per-key flags above (e.g. a submitting form). */
  disabled?: boolean
  className?: string
}

/**
 * Shared 3x4 on-screen numeric keypad — extracted from `PinPad` so the PIN
 * screens and the movement amount field reuse one implementation instead of
 * forking a second keypad (`AGENTS.md`). PIN-shaped usage renders no decimal
 * key at all (`onDecimal`/`decimalLabel` omitted); the amount field renders
 * one, positioned in the pad's own blank cell rather than appended as a 13th
 * key, so both shapes stay a 3x4 grid.
 */
export const NumericKeypad = ({
  onDigit,
  onDelete,
  onDecimal,
  decimalLabel,
  decimalAriaLabel,
  deleteAriaLabel,
  digitsDisabled,
  decimalDisabled,
  deleteDisabled,
  disabled,
  className,
}: NumericKeypadProps) => {
  const keys = buildKeys(decimalLabel !== undefined)

  return (
    <div className={cn('grid w-full grid-cols-3 gap-3', className)}>
      {keys.map((key, i) => {
        if (key.kind === 'blank') return <div key={`blank-${i}`} aria-hidden="true" />

        if (key.kind === 'delete') {
          return (
            <button
              key="delete"
              type="button"
              disabled={disabled || deleteDisabled}
              onClick={onDelete}
              aria-label={deleteAriaLabel}
              className="flex min-h-14 items-center justify-center rounded-2xl text-foreground transition-colors active:bg-muted disabled:opacity-40"
            >
              <Delete aria-hidden="true" className="size-5" />
            </button>
          )
        }

        if (key.kind === 'decimal') {
          return (
            <button
              key="decimal"
              type="button"
              disabled={disabled || decimalDisabled}
              onClick={onDecimal}
              aria-label={decimalAriaLabel}
              className="flex min-h-14 items-center justify-center rounded-2xl bg-card text-xl font-semibold text-foreground transition-colors active:bg-muted disabled:opacity-40"
            >
              {decimalLabel}
            </button>
          )
        }

        return (
          <button
            key={key.digit}
            type="button"
            disabled={disabled || digitsDisabled}
            onClick={() => onDigit(key.digit)}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-card text-xl font-semibold text-foreground transition-colors active:bg-muted disabled:opacity-40"
          >
            {key.digit}
          </button>
        )
      })}
    </div>
  )
}
