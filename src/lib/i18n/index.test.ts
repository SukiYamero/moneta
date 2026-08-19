import { describe, it, expect, afterEach } from 'vitest'
import { i18next } from '@/lib/i18n'

describe('i18n <html lang> sync', () => {
  afterEach(async () => {
    await i18next.changeLanguage('es')
  })

  it('sets document.documentElement.lang to the active locale on init', () => {
    expect(document.documentElement.lang).toBe('es')
  })

  it('updates document.documentElement.lang when the language changes', async () => {
    await i18next.changeLanguage('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
  })
})
