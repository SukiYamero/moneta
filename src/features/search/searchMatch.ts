// NFD decomposition separates a base letter from its combining diacritic.
// Escaped, not literal: most editors render U+0300..U+036F invisibly, and an
// NFC-normalizing tool would silently recombine them.
const COMBINING_MARKS = /[\u0300-\u036F]/gu

export const normalizeForSearch = (value: string): string =>
  value.trim().toLowerCase().normalize('NFD').replaceAll(COMBINING_MARKS, '')

export const matchesQuery = (query: string, ...fields: string[]): boolean => {
  const needle = normalizeForSearch(query)
  if (!needle) return true
  return fields.some((field) => normalizeForSearch(field).includes(needle))
}
