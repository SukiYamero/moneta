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

export type NumericKeypadSize = 'default' | 'compact'

// Shared shape for every key: the design export's own PIN padKeys grid
// (docs/ui/design-export-add-sheet.md, `export/Moneta-standalone.html`) —
// 62px-tall keys, 20px radius, a visible press state — ported to this app's
// own overlay-tint tokens rather than the export's raw `--mn-f*` values.
const KEY_SHAPE_CLASS =
  'flex items-center justify-center rounded-3xl transition-colors active:bg-border-hover disabled:opacity-40'
// The amount field's own usage runs ~15% shorter than the PIN-shaped
// default (62px -> 53px, still well above the 44px touch-target floor) so
// the full 3x4 grid fits on a small phone without its bottom row clipping
// (specs.md §10.54) — `PinPad` never passes `size`, so it keeps the
// original height unchanged.
const KEY_HEIGHT_CLASS: Record<NumericKeypadSize, string> = {
  default: 'min-h-15.5',
  compact: 'min-h-13.25',
}
// Digit/decimal keys get the stronger of the two overlay tints (the
// export's `--mn-f6`, this app's `--border`); delete gets the fainter one
// (`--mn-f3`/`--border-subtle`) — the same two-tier weighting the export
// itself uses, not an arbitrary choice.
const NUMERAL_KEY_CLASS = 'bg-border text-[1.5rem] font-semibold text-foreground'

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
  /** Key height — `'default'` (PIN-shaped callers) or `'compact'` (the amount field). */
  size?: NumericKeypadSize
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
  size = 'default',
}: NumericKeypadProps) => {
  const keys = buildKeys(decimalLabel !== undefined)
  const keyShapeClass = cn(KEY_SHAPE_CLASS, KEY_HEIGHT_CLASS[size])

  return (
    <div
      className={cn('grid w-full grid-cols-3 gap-3', className)}
      // A key is activated with a tap/click, not by holding focus — but a
      // button's own default pointerdown action focuses it regardless,
      // which would blur whatever the caller actually wants focus to stay
      // on (the amount input, so a focus-gated keypad doesn't unmount
      // itself mid-tap). preventDefault here cancels only that default
      // focus-shift; `click` still fires per the Pointer Events spec, so
      // every key keeps working exactly as before.
      onPointerDown={(event) => event.preventDefault()}
    >
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
              className={cn(keyShapeClass, 'bg-border-subtle text-foreground')}
            >
              <Delete aria-hidden="true" className="size-5.5 text-fg-tertiary" />
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
              className={cn(keyShapeClass, NUMERAL_KEY_CLASS)}
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
            className={cn(keyShapeClass, NUMERAL_KEY_CLASS)}
          >
            {key.digit}
          </button>
        )
      })}
    </div>
  )
}
