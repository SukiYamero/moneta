import { useDataStore } from '@/lib/dataStore'
import { applyTheme, persistTheme, resolveTheme, systemTheme } from '@/lib/theme'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export const syncStoredTheme = (): void => {
  useDataStore.subscribe((state, prevState) => {
    const tema = state.config?.preferencias.tema
    if (tema === undefined || tema === prevState.config?.preferencias.tema) return
    applyTheme(resolveTheme(tema))
    persistTheme(tema)
  })

  if (!supportsMatchMedia()) return
  window.matchMedia(DARK_MEDIA_QUERY).addEventListener('change', () => {
    const tema = useDataStore.getState().config?.preferencias.tema
    if (tema !== 'sistema') return
    applyTheme(systemTheme())
  })
}
