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
// point once grouping is stripped. `Number()` alone is not a strict enough
// validator for this: `Number('')` is `0` (a lone/duplicated group
// separator would silently collapse to "$0" instead of being rejected) and
// `Number('0x1a')` is `26` (a pasted hex-looking string would silently
// parse as a valid amount) — this regex closes both.
const NORMALIZED_AMOUNT = /^\d+(\.\d+)?$/

/**
 * Parses a raw amount string typed under `locale`'s grouping/decimal
 * convention into `Movimiento.monto` (always positive — sign comes from
 * `tipo`, schema.ts). Returns `undefined` for empty, negative, or
 * malformed input rather than `NaN`, so callers can treat "no value yet"
 * and "invalid value" as the same not-a-number case.
 */
export const parseAmount = (raw: string, locale: string): number | undefined => {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined

  const { decimal, group } = separatorsFor(locale)
  const normalized = trimmed.split(group).join('').replace(decimal, '.')
  if (!NORMALIZED_AMOUNT.test(normalized)) return undefined

  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/** The inverse of `parseAmount` — formats a stored amount for the input under `locale`, e.g. to prefill an edit form. */
export const formatAmountForInput = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
