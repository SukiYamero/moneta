import type { Preferencias } from '@/lib/schema'

export type Theme = Preferencias['tema']
export type ResolvedTheme = Exclude<Theme, 'sistema'>

export const THEME_STORAGE_KEY = 'kurobello-theme'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export const THEME_COLOR: Record<ResolvedTheme, string> = {
  oscuro: '#0c0d10',
  claro: '#f4f3ef',
}

const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export const systemTheme = (): ResolvedTheme =>
  supportsMatchMedia() && window.matchMedia(DARK_MEDIA_QUERY).matches ? 'oscuro' : 'claro'

export const resolveTheme = (tema: Theme): ResolvedTheme =>
  tema === 'sistema' ? systemTheme() : tema

export const applyTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.classList.toggle('dark', resolved === 'oscuro')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
}

export const persistTheme = (tema: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, tema)
  } catch {
    /* empty */
  }
}
