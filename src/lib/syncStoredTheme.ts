import { useDataStore } from '@/lib/dataStore'
import { applyTheme, persistTheme, resolveTheme, systemTheme } from '@/lib/theme'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Wires a stored `tema` to the `.dark` class once `Config` resolves —
 * mirrors `src/lib/i18n/syncStoredLocale.ts`'s shape for `idioma` (same
 * async-`Config`/synchronous-DOM-effect problem, same cross-store
 * subscription instead of `subscribeWithSelector` for one call site). Own
 * module rather than folded into `theme.ts`, for the same reason
 * `syncStoredLocale.ts` is its own module: it keeps the pure resolution
 * functions importable — and unit-testable — without pulling in the
 * `dataStore` subscription.
 *
 * `sistema` additionally tracks `prefers-color-scheme` live: specs.md
 * §10.30 requires a phone theme flipped mid-session to apply without a
 * reload, which a value read once at `Config`-load time can't do.
 *
 * Call once, from the app's boot entry point (`main.tsx`, alongside
 * `syncStoredLocale()`) — not this track's file to edit (docs/wave-4.1-plan.md
 * §2); see this track's own report for the escalation.
 */
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
