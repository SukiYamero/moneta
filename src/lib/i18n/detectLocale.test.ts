import { describe, it, expect, afterEach, vi } from 'vitest'
import { detectLocale, detectRegion } from '@/lib/i18n/detectLocale'

const stubLanguages = (languages: string[]): void => {
  vi.stubGlobal('navigator', { ...navigator, languages })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectLocale', () => {
  it.each([
    ['exact match', ['es-AR'], 'es-AR'],
    ['exact match', ['pt-BR'], 'pt-BR'],
    ['exact match', ['en'], 'en'],
    ['exact match', ['es'], 'es'],
    ['case-insensitive exact match', ['es-ar'], 'es-AR'],
    ['case-insensitive exact match', ['PT-br'], 'pt-BR'],
    ['subtag fallback for an unsupported Spanish variant', ['es-MX'], 'es'],
    ['subtag fallback for an unsupported Spanish variant', ['es-CO'], 'es'],
    ['subtag fallback for an unsupported Portuguese variant', ['pt-PT'], 'pt-BR'],
    ['subtag fallback for an unsupported English variant', ['en-GB'], 'en'],
    ['a first-choice subtag match beats a later exact match', ['pt-PT', 'es-AR'], 'pt-BR'],
    ['skips an unmatched candidate for the next preference', ['fr-FR', 'es-AR'], 'es-AR'],
    ['falls back to en with no es/en/pt subtag at all', ['fr-FR', 'de-DE'], 'en'],
    ['falls back to en for an empty languages list', [], 'en'],
  ] as const)('%s (%p)', (_label, languages, expected) => {
    expect(detectLocale([...languages])).toBe(expected)
  })

  it('reads navigator.languages by default when stubbed', () => {
    stubLanguages(['pt-BR'])
    expect(detectLocale()).toBe('pt-BR')
  })

  it('degrades to navigator.language, not straight to en, when navigator.languages is missing', () => {
    // Some browsers/webviews expose navigator without a languages array.
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: 'es-AR' })
    expect(detectLocale()).toBe('es-AR')
  })

  it('falls back to en only when neither navigator.languages nor navigator.language is available', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: undefined })
    expect(detectLocale()).toBe('en')
  })
})

describe('detectRegion', () => {
  it.each([
    ['exact tag', ['es-MX'], 'MX'],
    ['exact tag', ['es-AR'], 'AR'],
    ['exact tag', ['pt-BR'], 'BR'],
    ['case-insensitive, normalized to uppercase', ['es-mx'], 'MX'],
    ["the copy locale's canonical region, with no region subtag anywhere", ['es'], 'CO'],
    ["the copy locale's canonical region, with no region subtag anywhere", ['en'], 'US'],
    ["the copy locale's canonical region, with no region subtag anywhere", ['pt'], 'BR'],
    ['canonical fallback for a non-alphabetic (UN M49) region like es-419', ['es-419'], 'CO'],
  ] as const)('picks %s (%p)', (_label, languages, expected) => {
    expect(detectRegion([...languages])).toBe(expected)
  })

  it('honors preference order: the first candidate carrying a region subtag wins', () => {
    expect(detectRegion(['es', 'es-AR'])).toBe('AR')
  })

  it('accepts an explicit copyLocale fallback instead of re-deriving it from languages', () => {
    expect(detectRegion([], 'es-AR')).toBe('AR')
  })

  it('reads navigator.languages by default when stubbed', () => {
    stubLanguages(['es-MX'])
    expect(detectRegion()).toBe('MX')
  })

  it.each([
    ['an exact region tag', 'es-MX', 'MX'],
    ['the canonical region, for a bare language with no region subtag', 'es', 'CO'],
  ] as const)(
    'degrades to navigator.language for %s when navigator.languages is missing',
    (_label, language, expected) => {
      vi.stubGlobal('navigator', { ...navigator, languages: undefined, language })
      expect(detectRegion()).toBe(expected)
    },
  )

  it('falls back to the en/US default when navigator has no language info at all, matching detectLocale', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: undefined })
    expect(detectRegion()).toBe('US')
  })
})
