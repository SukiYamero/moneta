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

  it('prefers an exact match anywhere in the list over an earlier non-exact one', () => {
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
