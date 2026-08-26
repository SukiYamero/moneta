import { describe, expect, it } from 'vitest'
import { resolveActiveLocale } from '@/lib/i18n/localeResolution'

describe('resolveActiveLocale', () => {
  it('a stored idioma wins over the detected device locale', () => {
    expect(resolveActiveLocale('en', ['pt-BR'])).toBe('en')
  })

  it('falls back to the detected locale when nothing is stored ("seguir el dispositivo")', () => {
    expect(resolveActiveLocale(undefined, ['pt-BR'])).toBe('pt-BR')
  })
})
