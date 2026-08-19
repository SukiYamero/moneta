import { describe, it, expect, afterEach, vi } from 'vitest'
import { detectLocale, detectRegion } from '@/lib/i18n/detectLocale'

const stubLanguages = (languages: string[]): void => {
  vi.stubGlobal('navigator', { ...navigator, languages })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectLocale', () => {
  it('picks an exact match', () => {
    expect(detectLocale(['es-AR'])).toBe('es-AR')
    expect(detectLocale(['pt-BR'])).toBe('pt-BR')
    expect(detectLocale(['en'])).toBe('en')
    expect(detectLocale(['es'])).toBe('es')
  })

  it('is case-insensitive on the exact match', () => {
    expect(detectLocale(['es-ar'])).toBe('es-AR')
    expect(detectLocale(['PT-br'])).toBe('pt-BR')
  })

  it('falls back to a language-subtag match for an unsupported Spanish variant', () => {
    expect(detectLocale(['es-MX'])).toBe('es')
    expect(detectLocale(['es-CO'])).toBe('es')
  })

  it('falls back to a language-subtag match for an unsupported Portuguese variant', () => {
    expect(detectLocale(['pt-PT'])).toBe('pt-BR')
  })

  it('falls back to a language-subtag match for an unsupported English variant', () => {
    expect(detectLocale(['en-GB'])).toBe('en')
  })

  // Regression: navigator.languages is an ordered preference list. A first
  // choice served only by subtag must still beat a second choice that
  // happens to be an exact match — the earlier two-pass implementation
  // ("exact anywhere in the list" before "subtag anywhere in the list")
  // got this backwards and returned 'es-AR' here instead of 'pt-BR'.
  it('honors preference order: a first-choice subtag match beats a later exact match', () => {
    expect(detectLocale(['pt-PT', 'es-AR'])).toBe('pt-BR')
  })

  it('skips a candidate with no match at all and uses the next preference', () => {
    expect(detectLocale(['fr-FR', 'es-AR'])).toBe('es-AR')
  })

  it('falls back to en for a language with no es/en/pt subtag at all', () => {
    expect(detectLocale(['fr-FR', 'de-DE'])).toBe('en')
  })

  it('falls back to en for an empty languages list', () => {
    expect(detectLocale([])).toBe('en')
  })

  it('reads navigator.languages by default when stubbed', () => {
    stubLanguages(['pt-BR'])
    expect(detectLocale()).toBe('pt-BR')
  })

  // Regression: some browsers/webviews expose `navigator` without a
  // `languages` array (only the singular `navigator.language`). The default
  // parameter read `navigator.languages` unguarded, so `for...of` on
  // `undefined` threw at module-import time in `src/lib/i18n/index.ts`
  // (`lng: detectLocale()`), crashing app init before any UI could render.
  it('degrades to navigator.language, not straight to en, when navigator.languages is missing', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: 'es-AR' })
    expect(detectLocale()).toBe('es-AR')
  })

  it('falls back to en only when neither navigator.languages nor navigator.language is available', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: undefined })
    expect(detectLocale()).toBe('en')
  })
})

// Region is an axis independent of the copy locale above (specs.md §10.7):
// a device can run the app in neutral `es` copy while its region subtag is
// `MX`, `AR`, `BR`... `detectRegion` must never change what `detectLocale`
// resolves to — only tests a second, parallel extraction.
describe('detectRegion', () => {
  it('picks the region subtag off an exact tag', () => {
    expect(detectRegion(['es-MX'])).toBe('MX')
    expect(detectRegion(['es-AR'])).toBe('AR')
    expect(detectRegion(['pt-BR'])).toBe('BR')
  })

  it('is case-insensitive and normalizes to uppercase', () => {
    expect(detectRegion(['es-mx'])).toBe('MX')
  })

  it('honors preference order: the first candidate carrying a region subtag wins', () => {
    // "es" alone has no subtag; the next preference does.
    expect(detectRegion(['es', 'es-AR'])).toBe('AR')
  })

  it("falls back to the copy locale's canonical region when no candidate has a region subtag", () => {
    expect(detectRegion(['es'])).toBe('CO')
    expect(detectRegion(['en'])).toBe('US')
    expect(detectRegion(['pt'])).toBe('BR')
  })

  it('ignores a non-alphabetic (UN M49) region subtag like es-419 and falls back to canonical', () => {
    expect(detectRegion(['es-419'])).toBe('CO')
  })

  it('accepts an explicit copyLocale fallback instead of re-deriving it from languages', () => {
    expect(detectRegion([], 'es-AR')).toBe('AR')
  })

  it('reads navigator.languages by default when stubbed', () => {
    stubLanguages(['es-MX'])
    expect(detectRegion()).toBe('MX')
  })

  it('degrades to navigator.language when navigator.languages is missing, same as detectLocale', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: 'es-MX' })
    expect(detectRegion()).toBe('MX')
  })

  it('falls back to the en/US default when navigator has no language info at all, matching detectLocale', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: undefined })
    expect(detectRegion()).toBe('US')
  })

  it('is unchanged from today (CO) for a bare "es" navigator language, the pre-region-axis baseline', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: undefined, language: 'es' })
    expect(detectRegion()).toBe('CO')
  })
})
