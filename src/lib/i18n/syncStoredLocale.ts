import { i18next } from '@/lib/i18n'
import { resolveActiveLocale } from '@/lib/i18n/localeResolution'
import { useDataStore } from '@/lib/dataStore'

export const syncStoredLocale = (): void => {
  useDataStore.subscribe((state, prevState) => {
    const idioma = state.config?.preferencias.idioma
    if (idioma === prevState.config?.preferencias.idioma) return
    void i18next.changeLanguage(resolveActiveLocale(idioma))
  })
}
