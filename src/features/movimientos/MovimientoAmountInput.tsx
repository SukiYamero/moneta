import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { Moneda, TipoMovimiento } from '@/lib/schema'
import {
  decimalSeparatorFor,
  groupSeparatorFor,
  digitsBeforeIndex,
  formatAmountLive,
  indexAfterDigitCount,
  isAmountInputInvalid,
} from '@/lib/i18n/amountFormat'
import { Input } from '@/components/ui/input'
import { NumericKeypad } from '@/components/shared/NumericKeypad'
import { armKeypadDebugLog, logKeypadState } from '@/features/movimientos/keypadDebugLog'
import { cn } from '@/lib/utils'

/**
 * The one switch for the WebKit AutoFill-accessory clipping bug this field
 * used to hit (`docs/pendientes-usuario.md`): flip to `false` to bring back
 * the OS software keyboard (`inputMode="decimal"`, no on-screen pad) exactly
 * as it worked before. Kept local to this file rather than scattered across
 * the input's `inputMode`, the keypad's render guard and the ref wiring
 * separately.
 */
const SUPPRESS_NATIVE_KEYBOARD_FOR_AMOUNT = true

export interface MovimientoAmountInputProps {
  value: string
  onChange: (raw: string) => void
  /** BCP-47, from `useLocaleFormatting()` — same no-default convention as `MovimientoRow`. */
  locale: string
  moneda: Moneda
  /** Colors the digits — mirrors `movimientoView.ts`'s `AMOUNT_COLOR_CLASS` (income reads success-green, expense reads plain foreground). Kept as a small local table rather than importing a private module-scope const from that shared file. */
  tipo: TipoMovimiento
  error?: string
  disabled?: boolean
  placeholder?: string
  ref?: Ref<HTMLInputElement>
}

const AMOUNT_COLOR_CLASS: Record<TipoMovimiento, string> = {
  ingreso: 'text-success',
  gasto: 'text-foreground',
}

const currencySymbolFor = (moneda: Moneda, locale: string): string => {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? moneda
}

/**
 * The Add/Edit sheet's centered, borderless, auto-sizing amount display
 * (`docs/ui/design-export-add-sheet.md` §2, specs.md §10.41/§10.45) — now the
 * app's only amount input, after the bordered/labelled `AmountField` it was
 * built alongside was deleted for having no production caller left (specs.md
 * §10.47/§10.48). Reuses `parseAmountForInput` (via `isAmountInputInvalid`)
 * for the shared parsing rule, and `formatAmountLive` for the
 * live-grouping-as-you-type behavior this component owns.
 *
 * **Centering (specs.md §10.45):** the digits, not the `[symbol, digits]`
 * pair, must sit in the true center — a deliberate divergence from the
 * design export, which centers the pair as one group. The symbol is
 * balanced by an invisible mirror of itself on the input's other side
 * (`aria-hidden`, `invisible`) rather than pulled out of flow via absolute
 * positioning: `field-sizing: content` makes the input's own width change
 * on every keystroke, and a flex row that is symmetric around the input
 * (symbol · input · same-width invisible symbol, `justify-center`) keeps
 * the input's midpoint pinned to the row's midpoint regardless of that
 * width, with no percentage/pixel math to keep in sync with the symbol's
 * own (locale-dependent, e.g. "R$") rendered width.
 *
 * `field-sizing: content` (Baseline 2024, Chromium/Safari; not yet in
 * Firefox) is the one raw value the design export is worth lifting as-is —
 * the only sane way to get an auto-width centered numeric display without
 * measuring text in JS. `w-40` is the fallback width for an engine that
 * ignores it; a supporting engine gets `w-auto` back through the explicit
 * `supports-[…]` override below, never implicitly — see that comment.
 * `max-w-[calc(100%-3rem)]` (rather than the export's own `calc(100% -
 * 48px)` on the symbol+input pair) bounds the input alone against the flex
 * row's width — a flex item's percentage `max-width` resolves against its
 * container's *definite* width, which is why the row itself carries `w-full`
 * here: without it, the row sits inside a `flex-col items-center` parent,
 * whose cross-axis alignment leaves the row shrink-to-fit rather than
 * stretched, so the percentage would resolve against the row's own
 * content-driven (and therefore unbounded) width instead of the sheet's
 * real, visible one — reproduced: a six-digit `PEN` amount ("PEN 999.999",
 * a real `Moneda`/narrowSymbol pair, not a hypothetical) pushed the whole
 * row 62px past a 360px sheet with `max-w-[calc(100%-3rem)]` in place and
 * unchanged with it removed entirely, proving the clamp was inert until
 * `w-full` gave the row something definite to resolve against. Unlike the
 * same percentage placed on a CSS Grid `auto`-sized track (considered and
 * rejected: an auto track's contribution to grid sizing ignores an
 * indefinite percentage max-width, so a very long number could size the
 * track past the container before the percentage ever gets a chance to
 * clamp it) — the flex version only avoids that failure once its own
 * container is actually definite, not by virtue of being flex.
 */
export const MovimientoAmountInput = ({
  value,
  onChange,
  locale,
  moneda,
  tipo,
  error,
  disabled,
  placeholder,
  ref,
}: MovimientoAmountInputProps) => {
  const { t } = useTranslation('movimientos')
  const errorId = useId()
  const symbol = useMemo(() => currencySymbolFor(moneda, locale), [moneda, locale])
  const decimal = useMemo(() => decimalSeparatorFor(locale), [locale])
  const groupSeparator = useMemo(() => groupSeparatorFor(locale), [locale])
  const invalid = isAmountInputInvalid(value, locale, error)

  // Kept alongside the forwarded consumer `ref` (`AddMovimientoSheet`'s
  // `initialFocus`) so the keypad handlers below can read/write the same
  // DOM node's `.value`/selection that `handleChange` already does — same
  // merge-callback-ref shape as `useOverlay.ts`/`DateChipPicker.tsx`.
  const inputElRef = useRef<HTMLInputElement | null>(null)
  const setRef = (node: HTMLInputElement | null) => {
    inputElRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as { current: HTMLInputElement | null }).current = node
  }

  // The pad shows while focus is inside this field's own wrapper.
  // `initialFocus` (`AddMovimientoSheet`) focusing the input on sheet-open
  // is what makes the pad appear on open, with no extra wiring here.
  const [keypadOpen, setKeypadOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)

  const handleWrapperFocus = () => setKeypadOpen(true)

  // The one way the pad closes from a pointer gesture (as opposed to Tab or
  // the sheet itself closing): blurring the input keeps it from looking
  // focused once the pad backing it is gone.
  const dismissKeypad = () => {
    setKeypadOpen(false)
    inputElRef.current?.blur()
  }

  // Whether the gesture's own `pointerdown` landed on the input itself or
  // the pad — deliberately narrower than "this field's whole wrapper
  // column", so the label and the empty flanks beside a short amount
  // count as outside and dismiss it. No focus/blur decides this: a real
  // iOS log showed focus walking outside only *after* `pointerup` resolved.
  const gestureStartedInsidePadRef = useRef(true)

  // The collapse waits for `pointerup`, not `pointerdown`: this component
  // is in-flow, so collapsing it earlier shifts the layout under a gesture
  // still in flight, and the browser hit-tests that gesture's own
  // `pointerup`/`click` against whatever slid into its place instead.
  useEffect(() => {
    if (!keypadOpen) return
    logKeypadState('probe armed; pad is', wrapperRef.current)
    const stopDebugLog = armKeypadDebugLog(wrapperRef)
    // Reset to the safe default each time this effect (re)starts: the
    // gesture that reopens the pad can reach this effect's own `pointerup`
    // before its `pointerdown` was ever captured (mounted mid-gesture),
    // which would otherwise leave a stale value from an earlier gesture.
    gestureStartedInsidePadRef.current = true
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      gestureStartedInsidePadRef.current = !!(
        target &&
        (inputElRef.current?.contains(target) || padRef.current?.contains(target))
      )
    }
    const handlePointerUpOutside = () => {
      if (gestureStartedInsidePadRef.current) {
        // The gesture began on the pad's own surface — never a dismissal,
        // regardless of any focus change in between. Restore focus if it
        // drifted away mid-gesture, so the field ends up as it was before
        // the tap (best-effort — see specs.md §10.54 on its limits).
        if (document.activeElement !== inputElRef.current) {
          inputElRef.current?.focus()
        }
        return
      }
      logKeypadState('>>> PAD CLOSED', wrapperRef.current)
      dismissKeypad()
    }
    // A gesture that ends in `pointercancel` (the sheet body being
    // scrolled, a system gesture) never counts as an outside tap — same
    // "cancelled gesture is not user intent to dismiss" rule
    // `BottomSheet.tsx`'s own drag-to-dismiss already follows.
    const handlePointerCancel = () => {
      gestureStartedInsidePadRef.current = false
    }
    // Gated behind an explicit Tab so a touch-driven ambiguous blur (no Tab
    // key) can never trigger this — reacting on `focusout` rather than
    // synchronously in `keydown` matters too: closing here first would
    // unmount Tab's own reference element before its default action runs.
    let forwardTabPressed = false
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && !event.shiftKey) forwardTabPressed = true
    }
    const handleFocusOut = (event: FocusEvent) => {
      if (!forwardTabPressed) return
      forwardTabPressed = false
      const next = event.relatedTarget as Node | null
      if (next && wrapperRef.current?.contains(next)) return
      dismissKeypad()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointerup', handlePointerUpOutside)
    document.addEventListener('pointercancel', handlePointerCancel)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      stopDebugLog()
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUpOutside)
      document.removeEventListener('pointercancel', handlePointerCancel)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [keypadOpen])

  /**
   * Reformats synchronously and moves the caret **on the DOM node itself**,
   * before handing the formatted string to `onChange` — not via a `value`-
   * keyed effect once the prop round-trips back down. Reproduced: when the
   * reformatted string comes out byte-for-byte identical to the previous
   * one (e.g. deleting a separator that the formatter just reinserts),
   * `setValue(sameString)` is `Object.is`-equal to the current state, so
   * React bails out of the re-render entirely — this component's own
   * effects never run, yet React's controlled-input machinery still
   * force-corrects the DOM `.value` on its own, with no caret placement of
   * its own to speak of. Setting both `.value` and the selection here,
   * synchronously, works regardless of whether React ends up re-rendering
   * at all.
   *
   * Shared with the on-screen keypad below: `handleChange` feeds it a
   * `nextRaw`/`caretIndex` a native `input` event already spliced;
   * `handleKeypadDigit`/`handleKeypadDecimal`/`handleKeypadDelete` splice
   * one manually first, but land on this exact same reformat/caret path —
   * a pad tap must never bypass it (AGENTS.md).
   */
  const applyEdit = (nextRaw: string, caretIndex: number) => {
    const digitsBefore = digitsBeforeIndex(nextRaw, caretIndex)
    const formatted = formatAmountLive(nextRaw, locale)

    const el = inputElRef.current
    if (el) {
      el.value = formatted
      const caret = indexAfterDigitCount(formatted, digitsBefore)
      el.setSelectionRange(caret, caret)
    }

    onChange(formatted)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const el = event.target
    const rawFromDom = el.value
    const caretInDom = el.selectionStart ?? rawFromDom.length
    applyEdit(rawFromDom, caretInDom)
  }

  // The DOM node's own selection survives it losing focus to a tapped pad
  // button (blur doesn't reset `selectionStart`/`selectionEnd`), so reading
  // it here — rather than refocusing the input on every tap — lets a
  // screen-reader user stay on the button they just pressed instead of
  // being bounced back to the field each time.
  const currentSelection = (): [start: number, end: number] => {
    const el = inputElRef.current
    if (!el) return [value.length, value.length]
    return [el.selectionStart ?? value.length, el.selectionEnd ?? value.length]
  }

  const handleKeypadDigit = (digit: number) => {
    const [start, end] = currentSelection()
    applyEdit(value.slice(0, start) + digit + value.slice(end), start + 1)
  }

  const handleKeypadDecimal = () => {
    const [start, end] = currentSelection()
    applyEdit(value.slice(0, start) + decimal + value.slice(end), start + decimal.length)
  }

  // A collapsed caret can sit right after an auto-inserted grouping
  // separator — deleting "the character before it" there would remove
  // formatting the user never typed. Skipping back past grouping
  // separators only (never the decimal separator) finds real content.
  const handleKeypadDelete = () => {
    const [start, end] = currentSelection()
    if (start !== end) {
      applyEdit(value.slice(0, start) + value.slice(end), start)
      return
    }
    let removeAt = start - 1
    while (removeAt >= 0 && value[removeAt] === groupSeparator) removeAt--
    if (removeAt < 0) return
    applyEdit(value.slice(0, removeAt) + value.slice(removeAt + 1), removeAt)
  }

  return (
    <div ref={wrapperRef} onFocus={handleWrapperFocus} className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold text-fg-tertiary">{t('form.amountLabel')}</span>
      <div className="flex w-full items-center justify-center gap-2">
        <span aria-hidden="true" className="shrink-0 text-6xl font-extrabold text-fg-faint">
          {symbol}
        </span>
        <Input
          ref={setRef}
          type="text"
          inputMode={SUPPRESS_NATIVE_KEYBOARD_FOR_AMOUNT ? 'none' : 'decimal'}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder ?? '0'}
          aria-label={t('form.amountLabel')}
          aria-invalid={invalid}
          aria-describedby={error !== undefined ? errorId : undefined}
          className={cn(
            'h-auto w-40 min-w-12 max-w-[calc(100%-3rem)] border-none bg-transparent p-0 text-center text-[2.625rem] leading-none font-extrabold tracking-tight shadow-none',
            AMOUNT_COLOR_CLASS[tipo],
            // `field-sizing: content` does NOT override an explicit `width`
            // the way a fixed fallback width might suggest it would
            // (verified live: Chrome 151 kept the input pinned to `w-40`
            // until `width` itself was cleared) — the documented
            // progressive-enhancement shape is a `@supports` override, not
            // an implicit one. `supports-[field-sizing:content]:w-auto`
            // hands width back to the content-based algorithm only where
            // the feature is actually supported; `min-w-12`/the max-width
            // above still bound it either way.
            '[field-sizing:content] supports-[field-sizing:content]:w-auto',
          )}
        />
        <span aria-hidden="true" className="invisible shrink-0 text-6xl font-extrabold">
          {symbol}
        </span>
      </div>
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {SUPPRESS_NATIVE_KEYBOARD_FOR_AMOUNT && keypadOpen && (
        <NumericKeypad
          // `BottomSheet`'s scrollable body applies `px-5.5` — without the
          // bleed below, the pad's own box stops at that padded content
          // edge, so the ~22px strip down each side of the phone is
          // genuinely outside `wrapperRef` and a tap there dismissed the pad
          // even though a user reading the screen sees only the pad there
          // (specs.md §10.54). A *viewport*-relative bleed (`100dvw` off a
          // margin computed against `50%`) mixes two different reference
          // frames: `dvw` is half the viewport, `%` resolves against the
          // containing block's own content box, which a reserved-space
          // scrollbar narrows below the viewport's width — so the two no
          // longer cancel and the bled box drifts off-center by exactly the
          // scrollbar's width (reproduced live: a 15px scrollbar left the
          // pad's box 7.5px short of the right edge, the same "gutter
          // belongs to the pad" bug in a narrower form). `calc(100% +
          // 2.75rem)` (2.75rem = the two `px-5.5` insets this bleeds past,
          // this one and the ancestor's) avoids that: `%` here resolves
          // against this element's own flex-item parent, whose available
          // width already reflects the scrollbar with no viewport unit
          // involved — one reference frame, plus a fixed constant, never
          // two. A plain `-mx-5.5` alone (no `w-` override) does **not**
          // work here even though it reads correctly: this element is a
          // flex item under `wrapperRef`'s `items-center` (not `stretch`),
          // so a negative margin on an otherwise-`w-full` (definite,
          // 100%-of-parent) width just re-centers the *same*, un-widened
          // box — verified live, the margin had zero visible effect. Cross-
          // axis stretch only expands an `auto` cross size, and `auto`
          // isn't viable either: this element's `1fr` grid columns fall
          // back to content-sized tracks once the grid container's own
          // width is indefinite, breaking the even 3-column layout. The
          // explicit `calc()` width sidesteps both: always definite, so the
          // grid tracks stay evenly sized, and already the exact target
          // width, so the matching `-mx-5.5` only needs to reposition it,
          // not expand it. `px-5.5` rides along on this same element
          // (`NumericKeypad`'s grid, its only rendered element) to re-inset
          // the keys after the bleed reaches the true edges.
          ref={padRef}
          className="mt-2 w-[calc(100%+2.75rem)] -mx-5.5 px-5.5 animate-sheet-up"
          size="compact"
          disabled={disabled}
          deleteAutoRepeat
          onDigit={handleKeypadDigit}
          onDelete={handleKeypadDelete}
          onDecimal={handleKeypadDecimal}
          decimalLabel={decimal}
          decimalDisabled={value.includes(decimal)}
          deleteDisabled={value === ''}
          deleteAriaLabel={t('form.amount.keypad.deleteCta')}
          decimalAriaLabel={t('form.amount.keypad.decimalCta')}
        />
      )}
    </div>
  )
}
