import type { Preferencias } from '@/lib/schema'

export type Theme = Preferencias['tema']
export type ResolvedTheme = Exclude<Theme, 'sistema'>

/**
 * Mirrors `Preferencias.tema` outside IndexedDB so the theme is readable
 * synchronously at first paint (`index.html`'s inline script, before React
 * or `Config` exist) — specs.md §10.30. A theme preference is not sensitive
 * data, which is what makes `localStorage` legitimate here specifically
 * (`AGENTS.md` §7's ban is on sensitive data); see specs.md §11 for the
 * explicit record. `index.html`'s inline script duplicates this literal
 * key (it runs before the module graph loads, so it can't import it) —
 * `theme.boot-script.test.ts` asserts the two stay in sync.
 */
export const THEME_STORAGE_KEY = 'kurobello-theme'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

// Matches `--background` in `.dark`/`:root` (src/styles/index.css) — kept
// as a literal here because the CSS token system doesn't reach `<meta
// name="theme-color">`, the one other place this app already accepted a
// hardcoded hex for the same reason (this file's own history).
const THEME_COLOR: Record<ResolvedTheme, string> = {
  oscuro: '#0c0d10',
  claro: '#f4f3ef',
}

const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export const systemTheme = (): ResolvedTheme =>
  supportsMatchMedia() && window.matchMedia(DARK_MEDIA_QUERY).matches ? 'oscuro' : 'claro'

export const resolveTheme = (tema: Theme): ResolvedTheme =>
  tema === 'sistema' ? systemTheme() : tema

/** Toggles the `.dark` class Tailwind's `dark:` variant is wired to, and the browser-chrome color alongside it. */
export const applyTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.classList.toggle('dark', resolved === 'oscuro')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
}

export const persistTheme = (tema: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, tema)
  } catch {
    // Non-sensitive convenience mirror — losing it only costs a boot-time
    // flash on the next launch, never correctness (specs.md §11).
  }
}
