import { i18next } from '@/lib/i18n'
import { resolveActiveLocale } from '@/lib/i18n/localeResolution'
import { useDataStore } from '@/lib/dataStore'

/**
 * Wires a stored `idioma` to i18next once `Config` resolves — a stored
 * value wins over the boot-time detected locale (specs.md §10.24
 * Prerequisite 2). `dataStore.load()` is async (IndexedDB), so this can't
 * run at `@/lib/i18n`'s synchronous `init()`; call it once from
 * `main.tsx`, the same explicit-call pattern `initServiceWorkerUpdates()`
 * already uses there, rather than a module-level side effect.
 *
 * Deliberately its own module, not folded into `@/lib/i18n/index.ts`:
 * every test file's `src/test/setup.ts` imports that module for the shared
 * `i18next` instance, and a static `@/lib/dataStore` import there would
 * load the real store — and, transitively, the real `repoProvider.ts` —
 * before a test file's own `vi.mock('@/lib/repoProvider', …)` can
 * intercept it. Vitest's mock hoisting only rewrites imports the *test
 * file* makes; a module already evaluated by a setup file is cached before
 * that hoisting ever runs, so every `dataStore.test.ts`-style suite silently
 * started reading the real fake-repo seed data instead of its own mock the
 * moment this import landed at module scope — reproduced, not guessed:
 * 36 of `dataStore.test.ts`'s 46 tests failed against real seed data before
 * this was split out.
 *
 * `i18next.changeLanguage` changes the active language in place — no
 * remount, so an overlay open mid-change survives it (specs.md §10.24 edge
 * cases). Mirrors `lockStore.ts`'s own cross-store subscription
 * (`useAuthStore.subscribe`, comparing `prevState` by hand) rather than
 * pulling in the `subscribeWithSelector` middleware for one call site.
 */
export const syncStoredLocale = (): void => {
  useDataStore.subscribe((state, prevState) => {
    const idioma = state.config?.preferencias.idioma
    if (idioma === prevState.config?.preferencias.idioma) return
    void i18next.changeLanguage(resolveActiveLocale(idioma))
  })
}
