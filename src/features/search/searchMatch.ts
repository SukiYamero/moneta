// Accent- and case-insensitive substring match — this is a Spanish-language
// finance app (AGENTS.md § UI, docs/wave-2-plan.md § Track E3): typing
// "camion" must find "camión". NFD decomposition splits a base letter from
// its combining diacritic, so stripping the combining-marks block removes
// accents without touching the letters themselves — unlike `Intl.Collator`,
// which compares two whole strings for equality/order, not substring
// containment, so it doesn't fit a "does this text contain the query" check.
const COMBINING_MARKS = /[̀-ͯ]/g

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
