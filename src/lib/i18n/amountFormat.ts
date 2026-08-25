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

// Requires at least one digit either side of an optional single decimal
// point once grouping is stripped, with an optional leading sign so a
// negative amount is recognized as a well-formed *negative* number rather
// than falling through to "malformed" alongside actual garbage — the two
// mean different things to a form (docs/error-handling.md's `not_positive`
// vs `malformed`). `Number()` alone is not a strict enough validator for
// this either way: `Number('')` is `0` (a lone/duplicated group separator
// would silently collapse to "$0" instead of being rejected) and
// `Number('0x1a')` is `26` (a pasted hex-looking string would silently
// parse as a valid amount) — this regex closes both. It also has no
// exponent notation, so a pasted `1e999` (which `Number()` reads as
// `Infinity`) is rejected by the regex before `Number()` ever sees it.
const NORMALIZED_AMOUNT = /^-?\d+(\.\d+)?$/

export type ParsedAmount =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'malformed' | 'not_positive' }

/**
 * Parses a raw amount string typed under `locale`'s grouping/decimal
 * convention, distinguishing *why* it failed rather than collapsing every
 * failure into one `undefined` — the seam `docs/error-handling.md`
 * ("Options considered") reserves for pure, sync, expected-to-fail-often
 * UI-edge parsing. A form needs three different sentences ("ingresá un
 * monto" / "ese monto no se entiende" / "el monto debe ser mayor a
 * cero"), not one. `schema.ts`'s `monto` is always positive, so `0` is
 * `not_positive`, not a valid amount — unlike `parseAmount` below, which
 * used to accept it (specs.md §10.23 Decision 4).
 */
export const parseAmountForInput = (raw: string, locale: string): ParsedAmount => {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, reason: 'empty' }

  const { decimal, group } = separatorsFor(locale)
  const normalized = trimmed.split(group).join('').replace(decimal, '.')
  if (!NORMALIZED_AMOUNT.test(normalized)) return { ok: false, reason: 'malformed' }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, reason: 'malformed' }
  if (value <= 0) return { ok: false, reason: 'not_positive' }
  return { ok: true, value }
}

/**
 * `parseAmount` is `parseAmountForInput` with "no value yet" and "invalid
 * value" collapsed into one `undefined` — correct for a **display**
 * (`docs/error-handling.md`'s own note on this function), never for a
 * form, which wants `parseAmountForInput`'s distinct reasons instead. Kept
 * as the second shape of the one parser, not a second implementation.
 */
export const parseAmount = (raw: string, locale: string): number | undefined => {
  const result = parseAmountForInput(raw, locale)
  return result.ok ? result.value : undefined
}

/** The inverse of `parseAmount` — formats a stored amount for the input under `locale`, e.g. to prefill an edit form. */
export const formatAmountForInput = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)

/**
 * Whether an amount input should render `aria-invalid` — true for a
 * caller-supplied business-rule `error` (e.g. "amount required") or for
 * malformed typed text under `locale`. Deliberately **not** true for
 * `not_positive` (e.g. a bare `0`): that's a valid keystroke on the way to
 * `0,50`, not a typo (`docs/error-handling.md`'s malformed/not_positive
 * split, specs.md §10.23 Decision 4). Both `AmountField` and
 * `MovimientoAmountInput` read this off the same `parseAmountForInput`
 * result — extracted so the "how do I read this result as invalid" logic
 * can't drift between the two independently of the parsing rule itself.
 */
export const isAmountInputInvalid = (
  value: string,
  locale: string,
  error: string | undefined,
): boolean => {
  const parsed = parseAmountForInput(value, locale)
  const isMalformed = !parsed.ok && parsed.reason === 'malformed'
  return error !== undefined || isMalformed
}

const DIGITS_ONLY = /^\d*$/

/**
 * Live-reformats a raw amount string as the user types it, grouping the
 * integer part under `locale`'s own convention via `Intl` (never a
 * hand-rolled separator table, same rule as the rest of this file) while
 * leaving the fraction exactly as typed — a trailing decimal separator
 * ("1," on its way to "1,50") and a trailing fraction zero ("1,50") must
 * survive, and neither can if the fraction is ever round-tripped through
 * `Number()`.
 *
 * Deliberately a no-op (returns `raw` unchanged) for anything that is not
 * yet the shape of a number in progress — a second decimal separator, or a
 * character that is neither a digit, the locale's own separators, nor a
 * leading sign. **This is the judgement call this track owns**: normal
 * keyboard typing can only ever produce digits (plus the separators this
 * function itself just inserted), so in practice `malformed` becomes
 * unreachable from the keyboard — but a paste of genuine garbage ("abc",
 * "$100") is passed through untouched here and still reaches
 * `parseAmountForInput`'s `malformed` reason downstream, so
 * `isAmountInputInvalid` and the `form.amount.errors.malformed` copy stay
 * live, exercised code rather than a dead path (`docs/error-handling.md`:
 * never delete an error path another consumer still depends on).
 */
export const formatAmountLive = (raw: string, locale: string): string => {
  const { decimal, group } = separatorsFor(locale)
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw

  const decimalIndex = body.indexOf(decimal)
  const hasSecondDecimal = decimalIndex !== -1 && body.includes(decimal, decimalIndex + 1)
  if (hasSecondDecimal) return raw

  const integerPart = decimalIndex === -1 ? body : body.slice(0, decimalIndex)
  const fractionPart = decimalIndex === -1 ? undefined : body.slice(decimalIndex + decimal.length)

  const integerDigits = integerPart.split(group).join('')
  if (!DIGITS_ONLY.test(integerDigits)) return raw
  // Something was typed for the integer part, but stripping every group
  // separator left no digits at all (e.g. a lone "." in a locale where "."
  // groups thousands) — that is separator noise, not "no integer part yet"
  // (which is integerPart === '', a normal state while typing ",50"), so it
  // must not silently collapse to an empty, well-formed-looking string.
  if (integerPart !== '' && integerDigits === '') return raw
  if (fractionPart !== undefined && !DIGITS_ONLY.test(fractionPart)) return raw

  const groupedInteger =
    integerDigits === '' ? '' : new Intl.NumberFormat(locale).format(BigInt(integerDigits))
  const sign = negative ? '-' : ''

  return fractionPart === undefined
    ? sign + groupedInteger
    : sign + groupedInteger + decimal + fractionPart
}

const isDigitAt = (text: string, index: number): boolean => {
  const code = text.charCodeAt(index)
  return code >= 48 /* '0' */ && code <= 57 /* '9' */
}

/**
 * Counts the digit characters in `text` before `index` — the "how far
 * through the number, ignoring separators, is the caret" half of the
 * known-good reflow technique (specs.md §10.45): reformat on every
 * keystroke, but describe the caret's position in digits, not raw string
 * offset, since inserting/removing a separator shifts the offset without
 * the user having moved past any digit.
 */
export const digitsBeforeIndex = (text: string, index: number): number => {
  const clamped = Math.min(Math.max(index, 0), text.length)
  let count = 0
  for (let i = 0; i < clamped; i++) {
    if (isDigitAt(text, i)) count++
  }
  return count
}

/**
 * The inverse half: given a reformatted string, finds the index right
 * after the `digitCount`-th digit — where the caret belongs once the
 * string has been regrouped. Falls to the end of the string if it has
 * fewer digits than `digitCount` (e.g. the user just deleted a digit).
 *
 * Lands **after any separator run that immediately follows that digit**,
 * not right after the digit itself: those two positions carry the same
 * digit count (a separator contributes none), so "right after the digit"
 * is not the only valid answer, and landing before a separator the user
 * just typed is the wrong one — it silently re-typed the caret in front of
 * the separator, so the next keystroke inserted ahead of it instead of
 * after it (reproduced: typing "1,50" landed on "150," without this).
 */
export const indexAfterDigitCount = (text: string, digitCount: number): number => {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (isDigitAt(text, i)) {
      seen++
      if (seen === digitCount) {
        let end = i + 1
        while (end < text.length && !isDigitAt(text, end)) end++
        return end
      }
    }
  }
  return text.length
}
