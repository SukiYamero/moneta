import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeForSearch } from '@/features/search/searchMatch'

describe('normalizeForSearch()', () => {
  it('strips accents', () => {
    expect(normalizeForSearch('camión')).toBe('camion')
  })

  it('lowercases', () => {
    expect(normalizeForSearch('CAFÉ')).toBe('cafe')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeForSearch('  comida  ')).toBe('comida')
  })
})

describe('matchesQuery()', () => {
  // The exact case AGENTS.md/the track brief call out: a Spanish app where
  // "camion" doesn't find "camión" is broken.
  it('finds an accented field by its unaccented query', () => {
    expect(matchesQuery('camion', 'Viaje en camión')).toBe(true)
  })

  it('finds an accented query by its unaccented field', () => {
    expect(matchesQuery('camión', 'Viaje en camion')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matchesQuery('CAFÉ', 'café de la mañana')).toBe(true)
  })

  it('matches a substring anywhere in the field', () => {
    expect(matchesQuery('fé de la ma', 'café de la mañana')).toBe(true)
  })

  it('returns false when no field contains the query', () => {
    expect(matchesQuery('xyz', 'Comida', 'Café de la mañana')).toBe(false)
  })

  it('matches across multiple fields — a hit in any field counts', () => {
    expect(matchesQuery('comida', 'Café de la mañana', 'Comida')).toBe(true)
  })

  it('an empty query matches everything', () => {
    expect(matchesQuery('', 'anything at all')).toBe(true)
  })

  it('a whitespace-only query matches everything', () => {
    expect(matchesQuery('   ', 'anything at all')).toBe(true)
  })
})
