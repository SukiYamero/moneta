import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Moneda, TipoMovimiento } from '@/lib/schema'
import {
  decimalSeparatorFor,
  digitsBeforeIndex,
  formatAmountLive,
  indexAfterDigitCount,
  isAmountInputInvalid,
} from '@/lib/i18n/amountFormat'
import { Input } from '@/components/ui/input'
import { NumericKeypad } from '@/components/shared/NumericKeypad'
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

  // The pad shows exactly while focus is somewhere inside this field's own
  // wrapper (the input itself, or one of the pad's own keys) — never
  // hardcoded to "always on". `initialFocus` (`AddMovimientoSheet`) focusing
  // the input on sheet-open is what makes the pad appear on open, with no
  // extra wiring here.
  const [keypadOpen, setKeypadOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleWrapperFocus = () => setKeypadOpen(true)

  // The one way the pad ever closes from user intent (as opposed to the
  // sheet itself closing): an outside tap, or a tap/drag on the pad's own
  // dismiss bar (`NumericKeypad`'s `onDismiss`) — both call this directly
  // rather than each hiding the pad and clearing focus their own way.
  const dismissKeypad = () => {
    setKeypadOpen(false)
    inputElRef.current?.blur()
  }

  // True from the moment a pointer gesture starts (`pointerdown`) until it
  // ends (`pointerup`/`pointercancel`). `handleWrapperBlur` below defers to
  // `pointerup` while this is true, rather than acting immediately — the
  // browser can move focus (and so fire a *native* blur) as part of a
  // `mousedown`'s default action well before the finger lifts, e.g. tapping
  // a focusable outside control like a category chip. Set on `pointerdown`
  // rather than only tracking `dismissPendingRef` directly so the same gate
  // covers a blur from *any* cause during the gesture, not just the one the
  // outside-tap listener already knows about. Plain `useRef`s, not state:
  // both are read/written synchronously inside native-event handlers.
  const pointerGestureActiveRef = useRef(false)
  // Set when a deferred blur (above) decided the focus that left the
  // wrapper landed outside it — read once by the `pointerup` handler below,
  // which is the one that actually commits the close once the gesture ends.
  const dismissPendingRef = useRef(false)

  // Checking `relatedTarget` (the element about to receive focus) against
  // the wrapper, rather than closing on every blur unconditionally, is what
  // keeps the pad open across Tab-ing from the input onto one of its own
  // keys — a bare "close on blur" would unmount the very key that just
  // received focus. `NumericKeypad`'s own `pointerdown` preventDefault
  // handles a tap on one of the pad's own keys (focus never leaves the
  // input there, so this handler never even runs); a tap on a genuinely
  // focusable *outside* control (a category chip) does reach this handler,
  // via the browser's own mousedown-driven focus-shift onto that control.
  const handleWrapperBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && wrapperRef.current?.contains(next)) return
    if (pointerGestureActiveRef.current) {
      // Mid-gesture: record the decision, don't act on it yet — see the
      // pointer listener below for why.
      dismissPendingRef.current = true
      return
    }
    setKeypadOpen(false)
  }

  // iOS Safari never fires the blur above for a tap outside this field: it
  // only shifts focus away from a focused input when the tap target is
  // itself focusable, so tapping dead space (a label, a gap between fields)
  // leaves the input focused and the pad stuck open forever. A document-level
  // pointer listener fires on every platform regardless of what the tap
  // target is, so it doesn't depend on that platform-specific focus-shift
  // behavior at all.
  //
  // The actual collapse — whether from this listener noticing an outside
  // tap, or from `handleWrapperBlur` above deferring one — must not apply
  // before the pointer lifts. This component is in-flow, so collapsing it
  // moves everything below it up by the pad's full height; doing that
  // synchronously on the down-phase (either by gating this listener on
  // `pointerdown`, or by letting a mousedown-driven native blur collapse it
  // immediately) shifts the layout out from under a gesture still in
  // flight, and the browser hit-tests `pointerup`/`click` against whatever
  // slid into that spot instead — reproduced live: a tap on a category
  // chip behind the pad never selected it (`aria-pressed` stayed `false`),
  // because the collapse ran on its `pointerdown`. Committing the close
  // only on `pointerup` means the browser has already resolved that
  // event's own hit-test before this runs, so the mutation can no longer
  // retarget the gesture already in flight — the collapse still happens
  // before the browser's separate `click` dispatch, but that dispatch
  // reuses the `pointerdown`/`pointerup` targets already resolved at their
  // own dispatch time, not the DOM as it stands after this handler runs.
  //
  // `setKeypadOpen(false)` is called directly here — not only via
  // `inputElRef.current?.blur()` — because by `pointerup` the input may
  // already be genuinely blurred (native focus already moved to whatever
  // outside control was tapped, e.g. the note field): `.blur()` on an
  // already-blurred element is a no-op, which would otherwise leave the
  // pad stuck open with nothing left to fire a `blur` event. `.blur()` is
  // still called too, for the complementary case where the input is *still*
  // focused (dead space, no native focus-shift happened) — reusing it
  // rather than inventing a second way to clear the focus ring.
  useEffect(() => {
    if (!keypadOpen) return
    const handlePointerDown = () => {
      pointerGestureActiveRef.current = true
    }
    const handlePointerUpOutside = (event: PointerEvent) => {
      pointerGestureActiveRef.current = false
      const pendingFromBlur = dismissPendingRef.current
      dismissPendingRef.current = false
      const target = event.target as Node | null
      const targetOutside = !(target && wrapperRef.current?.contains(target))
      if (!pendingFromBlur && !targetOutside) return
      dismissKeypad()
    }
    // A gesture that ends in `pointercancel` (the sheet body being
    // scrolled, a system gesture) never counts as an outside tap — same
    // "cancelled gesture is not user intent to dismiss" rule
    // `BottomSheet.tsx`'s own drag-to-dismiss already follows — so this
    // only clears the flags, deliberately not closing the pad.
    const handlePointerCancel = () => {
      pointerGestureActiveRef.current = false
      dismissPendingRef.current = false
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointerup', handlePointerUpOutside)
    document.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUpOutside)
      document.removeEventListener('pointercancel', handlePointerCancel)
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

  const handleKeypadDelete = () => {
    const [start, end] = currentSelection()
    if (start !== end) {
      applyEdit(value.slice(0, start) + value.slice(end), start)
    } else if (start > 0) {
      applyEdit(value.slice(0, start - 1) + value.slice(start), start - 1)
    }
  }

  return (
    <div
      ref={wrapperRef}
      onFocus={handleWrapperFocus}
      onBlur={handleWrapperBlur}
      className="flex flex-col items-center gap-2"
    >
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
            'h-auto w-40 min-w-12 max-w-[calc(100%-3rem)] border-none bg-transparent p-0 text-center text-[2.875rem] leading-none font-extrabold tracking-tight shadow-none',
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
          // `BottomSheet`'s scrollable body applies `px-5.5` — without this,
          // the pad's own box stops at that padded content edge, so the
          // ~22px strip down each side of the phone is genuinely outside
          // `wrapperRef` and a tap there dismissed the pad even though a
          // user reading the screen sees only the pad there (specs.md
          // §10.54). The standard viewport-relative full-bleed technique
          // (`width: 100dvw` from a `margin` that cancels however far the
          // ancestor padding has indented this element) moves the DOM box
          // to match what's visually on screen, so the existing
          // `wrapperRef.contains()` check is correct again with no
          // measured/hardcoded padding value and no separate geometry —
          // self-adjusting to whatever the sheet's own padding is. Both
          // sides, deliberately: `wrapperRef` centers its children
          // (`items-center`), so a *wider-than-parent* child with only a
          // left margin overflows asymmetrically and gets re-centered
          // around its own (wrong) margin box — verified live (Chromium)
          // this lands short of both true edges. A symmetric margin keeps
          // the margin box exactly as wide as the parent's own content box,
          // so centering resolves to flush with no overflow to correct for.
          className="mt-2 w-[100dvw] mx-[calc(50%-50dvw)] animate-sheet-up"
          disabled={disabled}
          onDigit={handleKeypadDigit}
          onDelete={handleKeypadDelete}
          onDecimal={handleKeypadDecimal}
          decimalLabel={decimal}
          decimalDisabled={value.includes(decimal)}
          deleteDisabled={value === ''}
          deleteAriaLabel={t('form.amount.keypad.deleteCta')}
          decimalAriaLabel={t('form.amount.keypad.decimalCta')}
          onDismiss={dismissKeypad}
          dismissAriaLabel={t('form.amount.keypad.dismissCta')}
        />
      )}
    </div>
  )
}
