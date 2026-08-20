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
