import {
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

  // Checking `relatedTarget` (the element about to receive focus) against
  // the wrapper, rather than closing on every blur unconditionally, is what
  // keeps the pad open across Tab-ing from the input onto one of its own
  // keys — a bare "close on blur" would unmount the very key that just
  // received focus. `NumericKeypad`'s own `pointerdown` preventDefault
  // handles the pointer/touch/mouse case (focus never leaves the input at
  // all there, so this handler never even runs for a tap); this covers the
  // keyboard-navigation case that preventDefault can't reach.
  const handleWrapperBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && wrapperRef.current?.contains(next)) return
    setKeypadOpen(false)
  }

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
          className="mt-2 animate-sheet-up"
          disabled={disabled}
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
