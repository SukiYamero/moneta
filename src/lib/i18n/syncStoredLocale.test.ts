import { afterEach, describe, expect, it } from 'vitest'
import { i18next } from '@/lib/i18n'
import { syncStoredLocale } from '@/lib/i18n/syncStoredLocale'
import { useDataStore } from '@/lib/dataStore'
import { CONFIG_SEMILLA } from '@/lib/schema'

afterEach(async () => {
  useDataStore.setState({ config: null })
  await i18next.changeLanguage('es')
})

describe('syncStoredLocale', () => {
  it('applies a stored idioma once Config resolves with one', async () => {
    syncStoredLocale()
    useDataStore.setState({
      config: { ...CONFIG_SEMILLA, preferencias: { ...CONFIG_SEMILLA.preferencias, idioma: 'en' } },
    })
    await Promise.resolve()
    expect(i18next.resolvedLanguage).toBe('en')
  })

  it('falls back to the detected locale once idioma is written back to undefined', async () => {
    syncStoredLocale()
    useDataStore.setState({
      config: { ...CONFIG_SEMILLA, preferencias: { ...CONFIG_SEMILLA.preferencias, idioma: 'en' } },
    })
    await Promise.resolve()
    expect(i18next.resolvedLanguage).toBe('en')

    useDataStore.setState((state) => ({
      config: state.config && {
        ...state.config,
        preferencias: { ...state.config.preferencias, idioma: undefined },
      },
    }))
    await Promise.resolve()
    expect(i18next.resolvedLanguage).toBe('es')
  })

  it('does not call changeLanguage when an unrelated field changes', async () => {
    syncStoredLocale()
    useDataStore.setState({ config: CONFIG_SEMILLA })
    await Promise.resolve()
    expect(i18next.resolvedLanguage).toBe('es')

    useDataStore.setState((state) => ({
      config: state.config && {
        ...state.config,
        preferencias: { ...state.config.preferencias, primerDiaSemana: 0 },
      },
    }))
    await Promise.resolve()
    expect(i18next.resolvedLanguage).toBe('es')
  })
})
