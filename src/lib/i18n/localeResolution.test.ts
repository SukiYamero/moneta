import { describe, expect, it } from 'vitest'
import { resolveActiveLocale } from '@/lib/i18n/localeResolution'

describe('resolveActiveLocale', () => {
  it('a stored idioma wins over the detected device locale', () => {
    expect(resolveActiveLocale('en', ['pt-BR'])).toBe('en')
  })

  it('falls back to the detected locale when nothing is stored ("seguir el dispositivo")', () => {
    expect(resolveActiveLocale(undefined, ['pt-BR'])).toBe('pt-BR')
  })

  it('falls back to the detected locale when the stored value is undefined, not just absent', () => {
    // Round-tripped through a `Partial<Config>` patch that explicitly sets
    // `idioma: undefined` (specs.md §10.24's "seguir el dispositivo" write) —
    // must resolve identically to never having stored anything at all.
    const stored: string | undefined = undefined
    expect(resolveActiveLocale(stored, ['es-AR'])).toBe('es-AR')
  })
})
