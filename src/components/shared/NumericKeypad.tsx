import { useEffect, useRef, type Ref } from 'react'
import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

// Press-and-hold repeat timing for the delete key (amount field only, via
// `deleteAutoRepeat` — see that prop). Values are the standard "OS key
// repeat" shape: a longer initial delay so a normal tap never engages it,
// then a much shorter interval while held.
const DELETE_REPEAT_INITIAL_DELAY_MS = 450
const DELETE_REPEAT_INTERVAL_MS = 80

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
  'flex items-center justify-center rounded-3xl transition-colors active:bg-border-hover aria-disabled:opacity-40'
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
  /** Press-and-hold repeat on the delete key. Opt-in: `PinPad` (4-digit PIN) never passes it, so its behavior is unchanged. */
  deleteAutoRepeat?: boolean
  className?: string
  /** Key height — `'default'` (PIN-shaped callers) or `'compact'` (the amount field). */
  size?: NumericKeypadSize
  ref?: Ref<HTMLDivElement>
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
  deleteAutoRepeat,
  className,
  size = 'default',
  ref,
}: NumericKeypadProps) => {
  const keys = buildKeys(decimalLabel !== undefined)
  const keyShapeClass = cn(KEY_SHAPE_CLASS, KEY_HEIGHT_CLASS[size])

  const isDeleteDisabled = disabled || deleteDisabled
  // Read by the timers below, which outlive the render that scheduled them
  // and must always act on the latest `onDelete`/disabled state, not a
  // stale closure from the render at press-time.
  const isDeleteDisabledRef = useRef(isDeleteDisabled)
  isDeleteDisabledRef.current = isDeleteDisabled
  const onDeleteRef = useRef(onDelete)
  onDeleteRef.current = onDelete

  const deleteRepeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Set once the hold has actually started repeating, so the `click` that
  // still fires on release isn't read as a second, duplicate delete on
  // top of what the hold itself already did.
  const repeatEngagedRef = useRef(false)

  const stopDeleteRepeat = () => {
    if (deleteRepeatTimeoutRef.current !== null) {
      clearTimeout(deleteRepeatTimeoutRef.current)
      deleteRepeatTimeoutRef.current = null
    }
    if (deleteRepeatIntervalRef.current !== null) {
      clearInterval(deleteRepeatIntervalRef.current)
      deleteRepeatIntervalRef.current = null
    }
  }

  useEffect(() => stopDeleteRepeat, [])

  const handleDeletePointerDown = () => {
    if (!deleteAutoRepeat || isDeleteDisabledRef.current) return
    repeatEngagedRef.current = false
    deleteRepeatTimeoutRef.current = setTimeout(() => {
      if (isDeleteDisabledRef.current) return
      repeatEngagedRef.current = true
      onDeleteRef.current()
      deleteRepeatIntervalRef.current = setInterval(() => {
        if (isDeleteDisabledRef.current) {
          stopDeleteRepeat()
          return
        }
        onDeleteRef.current()
      }, DELETE_REPEAT_INTERVAL_MS)
    }, DELETE_REPEAT_INITIAL_DELAY_MS)
  }

  const handleDeleteClick = () => {
    if (isDeleteDisabled) return
    // The hold already deleted through this same tick's own `onDelete()`
    // call — the release's `click` is not a second, fresh tap.
    if (deleteAutoRepeat && repeatEngagedRef.current) {
      repeatEngagedRef.current = false
      return
    }
    onDelete()
  }

  return (
    <div
      ref={ref}
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
              aria-disabled={isDeleteDisabled}
              onPointerDown={handleDeletePointerDown}
              onPointerUp={stopDeleteRepeat}
              onPointerLeave={stopDeleteRepeat}
              onPointerCancel={stopDeleteRepeat}
              onClick={handleDeleteClick}
              aria-label={deleteAriaLabel}
              className={cn(keyShapeClass, 'bg-border-subtle text-foreground')}
            >
              <Delete aria-hidden="true" className="size-5.5 text-fg-tertiary" />
            </button>
          )
        }

        if (key.kind === 'decimal') {
          const isDisabled = disabled || decimalDisabled
          return (
            <button
              key="decimal"
              type="button"
              aria-disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onDecimal?.()
              }}
              aria-label={decimalAriaLabel}
              className={cn(keyShapeClass, NUMERAL_KEY_CLASS)}
            >
              {decimalLabel}
            </button>
          )
        }

        const isDisabled = disabled || digitsDisabled
        return (
          <button
            key={key.digit}
            type="button"
            aria-disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onDigit(key.digit)
            }}
            className={cn(keyShapeClass, NUMERAL_KEY_CLASS)}
          >
            {key.digit}
          </button>
        )
      })}
    </div>
  )
}
