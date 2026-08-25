import { useId, useMemo, type ChangeEvent, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { Moneda, TipoMovimiento } from '@/lib/schema'
import {
  digitsBeforeIndex,
  formatAmountLive,
  indexAfterDigitCount,
  isAmountInputInvalid,
} from '@/lib/i18n/amountFormat'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface MovimientoAmountInputProps {
  value: string
  onChange: (raw: string) => void
  /** BCP-47, from `useLocaleFormatting()` — same no-default convention as `AmountField`/`MovimientoRow`. */
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
 * (`docs/ui/design-export-add-sheet.md` §2, specs.md §10.41/§10.45) —
 * deliberately not `AmountField` (bordered, labelled, no adornment slot):
 * that shared component has no way to produce a borderless field with an
 * external currency-symbol sibling short of editing it, and this is the
 * sheet's one giant display field, not a form-list row like every other
 * `AmountField` consumer. Reuses `parseAmountForInput` (via
 * `isAmountInputInvalid`) for the same parsing rule, and `formatAmountLive`
 * for the live-grouping-as-you-type behavior this component owns.
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
  const invalid = isAmountInputInvalid(value, locale, error)

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
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const el = event.target
    const rawFromDom = el.value
    const caretInDom = el.selectionStart ?? rawFromDom.length
    const digitsBefore = digitsBeforeIndex(rawFromDom, caretInDom)
    const formatted = formatAmountLive(rawFromDom, locale)

    el.value = formatted
    const caret = indexAfterDigitCount(formatted, digitsBefore)
    el.setSelectionRange(caret, caret)

    onChange(formatted)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold text-fg-tertiary">{t('form.amountLabel')}</span>
      <div className="flex w-full items-center justify-center gap-2">
        <span aria-hidden="true" className="shrink-0 text-6xl font-extrabold text-fg-faint">
          {symbol}
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
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
    </div>
  )
}
