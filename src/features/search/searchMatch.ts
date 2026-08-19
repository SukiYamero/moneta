// Accent- and case-insensitive substring match — this is a Spanish-language
// finance app (AGENTS.md § UI, docs/wave-2-plan.md § Track E3): typing
// "camion" must find "camión". NFD decomposition splits a base letter from
// its combining diacritic, so stripping the combining-marks block removes
// accents without touching the letters themselves — unlike `Intl.Collator`,
// which compares two whole strings for equality/order, not substring
// containment, so it doesn't fit a "does this text contain the query" check.
//
// Written as \uXXXX escapes, not literal combining characters, on purpose:
// a literal U+0300..U+036F sitting in this file renders as nothing (or as
// marks stacked on the neighboring bracket) in most editors, and — the real
// risk — any tool that normalizes the source to NFC could silently
// recombine or drop them, changing the class with nothing in the toolchain
// (tsc/oxlint/lint:units) able to flag it. Escapes are immune to that.
const COMBINING_MARKS = /[\u0300-\u036F]/gu

export const normalizeForSearch = (value: string): string =>
  value.trim().toLowerCase().normalize('NFD').replaceAll(COMBINING_MARKS, '')

/**
 * `true` when `query` is found in any of `fields`, accent- and
 * case-insensitively. An empty/whitespace-only query matches everything —
 * "no query" narrows nothing.
 */
export const matchesQuery = (query: string, ...fields: string[]): boolean => {
  const needle = normalizeForSearch(query)
  if (!needle) return true
  return fields.some((field) => normalizeForSearch(field).includes(needle))
}
