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
import { useIsCoarsePointer } from '@/components/shared/useIsCoarsePointer'
import { armKeypadDebugLog, logKeypadState } from '@/features/movimientos/keypadDebugLog'
import { cn } from '@/lib/utils'

export interface MovimientoAmountInputProps {
  value: string
  onChange: (raw: string) => void
  locale: string
  moneda: Moneda
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

// A generous upper bound on how long a real touch-to-`click` translation can
// take — only reached when a gesture's own `click` never arrives at all.
const DISMISS_AFTER_CLICK_TIMEOUT_MS = 400

const currencySymbolFor = (moneda: Moneda, locale: string): string => {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? moneda
}

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
  // Works around a WebKit AutoFill-accessory clipping bug on iOS.
  const isCoarsePointer = useIsCoarsePointer()
  const errorId = useId()
  const symbol = useMemo(() => currencySymbolFor(moneda, locale), [moneda, locale])
  const decimal = useMemo(() => decimalSeparatorFor(locale), [locale])
  const groupSeparator = useMemo(() => groupSeparatorFor(locale), [locale])
  const invalid = isAmountInputInvalid(value, locale, error)

  const inputElRef = useRef<HTMLInputElement | null>(null)
  const setRef = (node: HTMLInputElement | null) => {
    inputElRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as { current: HTMLInputElement | null }).current = node
  }

  const [keypadOpen, setKeypadOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)

  const handleWrapperFocus = () => {
    if (isCoarsePointer) setKeypadOpen(true)
  }

  const dismissKeypad = () => {
    setKeypadOpen(false)
    inputElRef.current?.blur()
  }

  // On iOS Safari, focus moves to the new target only after `pointerup`
  // resolves, so focus/blur alone can't tell where the gesture started.
  const gestureStartedInsidePadRef = useRef(true)

  // Collapsing on pointerup would shift the layout under this gesture's own
  // click before it hit-tests; the collapse waits for that click (or a
  // timeout) instead.
  useEffect(() => {
    if (!keypadOpen) return
    logKeypadState('probe armed; pad is', wrapperRef.current)
    const stopDebugLog = armKeypadDebugLog(wrapperRef)
    gestureStartedInsidePadRef.current = true
    let cancelPendingDismiss: (() => void) | null = null
    const scheduleDismiss = () => {
      if (cancelPendingDismiss) return
      const finish = () => {
        cancelPendingDismiss = null
        document.removeEventListener('click', finish, true)
        clearTimeout(timeoutId)
        dismissKeypad()
      }
      const timeoutId = setTimeout(finish, DISMISS_AFTER_CLICK_TIMEOUT_MS)
      document.addEventListener('click', finish, { capture: true, once: true })
      cancelPendingDismiss = () => {
        document.removeEventListener('click', finish, true)
        clearTimeout(timeoutId)
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      gestureStartedInsidePadRef.current = !!(
        target &&
        (inputElRef.current?.contains(target) || padRef.current?.contains(target))
      )
    }
    const handlePointerUpOutside = () => {
      if (gestureStartedInsidePadRef.current) {
        if (document.activeElement !== inputElRef.current) {
          inputElRef.current?.focus()
        }
        return
      }
      logKeypadState('>>> PAD CLOSED', wrapperRef.current)
      scheduleDismiss()
    }
    const handlePointerCancel = () => {
      gestureStartedInsidePadRef.current = false
    }
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
      cancelPendingDismiss?.()
      stopDebugLog()
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUpOutside)
      document.removeEventListener('pointercancel', handlePointerCancel)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [keypadOpen])

  // React skips the re-render when the value is `Object.is`-equal, yet its
  // controlled-input machinery still force-corrects the DOM value, caret unset.
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

  // Blur does not reset an input's selectionStart/selectionEnd.
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
          inputMode={isCoarsePointer ? 'none' : 'decimal'}
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
            // Chrome keeps an explicit `width` pinned even where field-sizing:
            // content is supported, so the content-based width must come from
            // an explicit `@supports` override rather than the bare property.
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
      {isCoarsePointer && keypadOpen && (
        <NumericKeypad
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
