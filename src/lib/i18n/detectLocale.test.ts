import { describe, it, expect, afterEach, vi } from 'vitest'
import { detectLocale } from '@/lib/i18n/detectLocale'

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
})
