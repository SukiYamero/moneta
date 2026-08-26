import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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

// Shared shape for every key: the design export's own PIN padKeys grid
// (docs/ui/design-export-add-sheet.md, `export/Moneta-standalone.html`) —
// 62px-tall keys, 20px radius, a visible press state — ported to this app's
// own overlay-tint tokens rather than the export's raw `--mn-f*` values.
const KEY_SHAPE_CLASS =
  'flex min-h-15.5 items-center justify-center rounded-3xl transition-colors active:bg-border-hover disabled:opacity-40'
// Digit/decimal keys get the stronger of the two overlay tints (the
// export's `--mn-f6`, this app's `--border`); delete gets the fainter one
// (`--mn-f3`/`--border-subtle`) — the same two-tier weighting the export
// itself uses, not an arbitrary choice.
const NUMERAL_KEY_CLASS = 'bg-border text-[1.5rem] font-semibold text-foreground'

// Deliberately smaller than `BottomSheet`'s own 120px `DRAG_DISMISS_THRESHOLD_PX`:
// that threshold dismisses the entire sheet, a much larger and more
// consequential gesture; this one only hides an inline keypad, so a shorter,
// still-deliberate drag (roughly one key's own height) is the right amount
// of commitment to ask for.
const DISMISS_DRAG_THRESHOLD_PX = 48

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
  /**
   * Renders a drag-handle bar above the grid — tap it, or drag it down past
   * the threshold, to dismiss. Omit for a caller with no such affordance
   * (`PinPad`, which is never manually dismissed this way): the bar and its
   * drag handling render nothing at all, keeping that usage byte-identical.
   * A real `<button>`, not a plain `div`, so a keyboard/screen-reader user
   * has the same path a pointer drag is only ever an enhancement on top of.
   */
  onDismiss?: () => void
  dismissAriaLabel?: string
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
  onDismiss,
  dismissAriaLabel,
}: NumericKeypadProps) => {
  const keys = buildKeys(decimalLabel !== undefined)

  // Drag state for the dismiss bar below — same shape as `BottomSheet`'s own
  // handle (`dragY`/`dragging`/`setPointerCapture`), scoped entirely to the
  // bar's own pointer events so it can never be confused with, or fight,
  // that unrelated drag-to-dismiss-the-whole-sheet gesture living on a
  // different element.
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  // Whether `pointermove` fired at all during the current gesture — a
  // button's own native `click` fires after `pointerup` regardless of any
  // movement in between, which would otherwise call `onDismiss` a second
  // time (a real drag past the threshold) or a first, unwanted time (a
  // small drag *below* the threshold, meant to spring back rather than
  // dismiss). `handleBarClick` below defers entirely to the drag handlers'
  // own decision whenever a drag actually happened; a plain tap (no
  // intervening move) has nothing for them to decide, so `click` is what
  // fires `onDismiss` there — the same event a keyboard Enter/Space
  // activation produces with no pointer sequence at all.
  const draggedRef = useRef(false)

  const handleBarPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Same reasoning as the grid's own `onPointerDown` above: a button's
    // default pointerdown action would otherwise focus it, stealing focus
    // from the amount input mid-gesture.
    event.preventDefault()
    dragStartY.current = event.clientY
    pointerIdRef.current = event.pointerId
    draggedRef.current = false
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleBarPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) return
    draggedRef.current = true
    setDragY(Math.max(0, event.clientY - dragStartY.current))
  }

  const releaseBarCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current === null) return
    if (event.currentTarget.hasPointerCapture?.(pointerIdRef.current)) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current)
    }
    pointerIdRef.current = null
  }

  const handleBarPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    releaseBarCapture(event)
    if (!dragging) return
    setDragging(false)
    if (draggedRef.current && dragY > DISMISS_DRAG_THRESHOLD_PX) onDismiss?.()
    setDragY(0)
  }

  // A cancelled gesture (system gesture, multi-touch conflict, pointer
  // capture lost outright) never counts as intent to dismiss — same rule
  // `BottomSheet.tsx`'s own drag-to-dismiss follows.
  const handleBarPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    releaseBarCapture(event)
    setDragging(false)
    setDragY(0)
  }

  const handleBarClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    onDismiss?.()
  }

  const grid = (
    <div
      className={cn(
        'grid w-full grid-cols-3 gap-3',
        // The dismiss bar's own outer container bleeds to the true
        // viewport edges (`MovimientoAmountInput.tsx`) so the strip beside
        // the keys belongs to the pad's own hit-test box, not the sheet's
        // scrollable body — but that box existing there doesn't mean the
        // *keys* should render there too. Re-applying the sheet's own
        // `px-5.5` here, on the grid alone, keeps the keys sitting exactly
        // where they always did (specs.md §10.54) while the invisible box
        // around them still reaches the edges.
        onDismiss ? 'px-5.5' : className,
      )}
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
              className={cn(KEY_SHAPE_CLASS, 'bg-border-subtle text-foreground')}
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
              className={cn(KEY_SHAPE_CLASS, NUMERAL_KEY_CLASS)}
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
            className={cn(KEY_SHAPE_CLASS, NUMERAL_KEY_CLASS)}
          >
            {key.digit}
          </button>
        )
      })}
    </div>
  )

  if (!onDismiss) return grid

  return (
    <div
      className={cn(className, 'transition-transform duration-200 ease-ios')}
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transitionDuration: dragging ? '0ms' : undefined,
      }}
    >
      {/* Visually a sibling of `BottomSheet`'s own grab handle — same pill
          (`h-1.25 w-9.5 rounded-full bg-border-strong`) in a full-width row,
          so it reads as the same "drag me" affordance rather than a new
          invention. A real `<button>`, not that handle's plain `div`: tap
          is the primary path here (this bar's dismiss action has no other
          trigger the way the sheet's own handle has the backdrop/Escape),
          so it needs its own accessible name and keyboard activation. */}
      <button
        type="button"
        onClick={handleBarClick}
        onPointerDown={handleBarPointerDown}
        onPointerMove={handleBarPointerMove}
        onPointerUp={handleBarPointerUp}
        onPointerCancel={handleBarPointerCancel}
        aria-label={dismissAriaLabel}
        className="mb-1 flex min-h-11 w-full shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
      >
        <span aria-hidden="true" className="h-1.25 w-9.5 rounded-full bg-border-strong" />
      </button>
      {grid}
    </div>
  )
}
