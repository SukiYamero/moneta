import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { enUS, es, ptBR } from 'date-fns/locale'
import { i18next } from '@/lib/i18n'
import { localeFormatting, useLocaleFormatting } from '@/lib/i18n/localeFormatting'

describe('localeFormatting', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    await i18next.changeLanguage('es')
  })

  it('combines the copy locale with the given region into an Intl tag', () => {
    expect(localeFormatting('es', 'CO')).toEqual({ locale: 'es-CO', dateFnsLocale: es })
    expect(localeFormatting('es-AR', 'AR')).toEqual({ locale: 'es-AR', dateFnsLocale: es })
    expect(localeFormatting('en', 'US')).toEqual({ locale: 'en-US', dateFnsLocale: enUS })
    expect(localeFormatting('pt-BR', 'BR')).toEqual({ locale: 'pt-BR', dateFnsLocale: ptBR })
  })

  it("prefers the given region over the copy locale's own default region", () => {
    // Region is the device's, independent of what the copy locale would
    // default to on its own — a neutral `es` copy locale on a device in
    // Mexico must format as es-MX, not es-CO.
    expect(localeFormatting('es', 'MX')).toEqual({ locale: 'es-MX', dateFnsLocale: es })
    expect(localeFormatting('es', 'AR')).toEqual({ locale: 'es-AR', dateFnsLocale: es })
  })

  it('falls back to the base locale for an unknown or missing tag, keeping the given region', () => {
    expect(localeFormatting('de', 'CO')).toEqual(localeFormatting('es', 'CO'))
    expect(localeFormatting(undefined, 'CO')).toEqual(localeFormatting('es', 'CO'))
  })

  it('reads the active i18next copy locale and the device region, and follows a language change', async () => {
    // Device region is stubbed to CO by src/test/setup.ts (jsdom defaults to en-US).
    const { result, rerender } = renderHook(() => useLocaleFormatting())
    expect(result.current).toEqual({ locale: 'es-CO', dateFnsLocale: es })

    await i18next.changeLanguage('en')
    rerender()
    // Copy language changed; the device region (CO) did not — they are
    // independent axes.
    expect(result.current).toEqual({ locale: 'en-CO', dateFnsLocale: enUS })
  })

  it("prefers the device's real region over the copy locale's default, through the hook", () => {
    vi.stubGlobal('navigator', { ...navigator, languages: ['es-MX'] })
    const { result } = renderHook(() => useLocaleFormatting())
    expect(result.current).toEqual({ locale: 'es-MX', dateFnsLocale: es })
  })
})
