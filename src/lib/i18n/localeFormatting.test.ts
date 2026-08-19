import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { enUS, es, ptBR } from 'date-fns/locale'
import { i18next } from '@/lib/i18n'
import { localeFormatting, useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { formatMonto } from '@/components/shared/movimientoView'

describe('localeFormatting', () => {
  afterEach(async () => {
    await i18next.changeLanguage('es')
  })

  it('maps every supported locale to an Intl tag and a date-fns locale', () => {
    expect(localeFormatting('es')).toEqual({ locale: 'es-CO', dateFnsLocale: es })
    expect(localeFormatting('es-AR')).toEqual({ locale: 'es-AR', dateFnsLocale: es })
    expect(localeFormatting('en')).toEqual({ locale: 'en-US', dateFnsLocale: enUS })
    expect(localeFormatting('pt-BR')).toEqual({ locale: 'pt-BR', dateFnsLocale: ptBR })
  })

  it('falls back to the base locale for an unknown or missing tag', () => {
    expect(localeFormatting('de')).toEqual(localeFormatting('es'))
    expect(localeFormatting(undefined)).toEqual(localeFormatting('es'))
  })

  it('keeps the es tag formatting amounts exactly as before any locale was wired', () => {
    expect(formatMonto(3200, 'COP', localeFormatting('es').locale)).toBe(
      formatMonto(3200, 'COP', 'es-CO'),
    )
  })

  it('reads the active i18next locale, and follows a language change', async () => {
    const { result, rerender } = renderHook(() => useLocaleFormatting())
    expect(result.current.locale).toBe('es-CO')

    await i18next.changeLanguage('en')
    rerender()
    expect(result.current).toEqual({ locale: 'en-US', dateFnsLocale: enUS })
  })
})
