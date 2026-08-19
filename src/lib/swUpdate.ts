/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'
import { toast } from '@/lib/toastStore'

// Duck-typed against `vite-plugin-pwa/types`' `RegisterSWOptions`/return
// value rather than importing those types, so `createSwUpdateController`
// takes a plain function and needs no `virtual:pwa-register` module (or a
// vitest alias faking one) to be unit-tested — a fake `registerSW` that
// matches this shape is enough. `registerSW` itself, imported above, is the
// one call site that touches the real virtual module.
interface RegisterSWDeps {
  onNeedRefresh?: () => void
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void
  onRegisterError?: (error: unknown) => void
}
type UpdateServiceWorker = () => Promise<void>
type RegisterSWFn = (options: RegisterSWDeps) => UpdateServiceWorker

export interface SwUpdateController {
  /** Applies the waiting service worker and reloads — call only from a deliberate user action. */
  applyUpdate: () => Promise<void>
}

// The Page Visibility API has no native "check now" hook for a service
// worker; polling `registration.update()` is the documented way
// (https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html) to
// notice a deploy in a tab that never navigates again. Hourly is frequent
// enough for a personal-finance app with no urgent security patches riding
// on it, and infrequent enough not to spam the network on a metered
// connection.
const PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Pure factory around `virtual:pwa-register`'s `registerSW` — this is the
 * whole registration lifecycle, injectable so tests never need the real
 * virtual module. `registerType: 'prompt'` (vite.config.ts) means the
 * underlying `updateServiceWorker` only sends skip-waiting (and the new
 * worker only reloads the page) when *we* call it — never on its own — so
 * "don't reload out from under a user mid-input" holds by construction:
 * nothing here calls it except `applyUpdate`, and nothing calls
 * `applyUpdate` except a deliberate user action.
 *
 * "Don't nag on every navigation" also holds by construction: this factory
 * runs registration exactly once (whoever calls it decides when), not per
 * route change, and a genuinely repeated `onNeedRefresh` call reaches
 * `toast.success` with the same message every time — `toastStore`'s own
 * duplicate-collapse (same variant + message re-raises the existing card
 * instead of stacking a new one) is what keeps that from nagging, so this
 * module doesn't need its own "already shown" flag on top of it.
 */
export const createSwUpdateController = (registerSW: RegisterSWFn): SwUpdateController => {
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => {
      toast.success('update:available')
    },
    onRegisteredSW: (_swScriptUrl, registration) => {
      if (!registration) return
      const intervalId = setInterval(() => {
        // A failed check is routine (offline, a captive portal, a transient
        // fetch failure) and self-heals on the next interval — the "expected
        // negative outcome with its own separate recovery path" exception
        // docs/error-handling.md §2 carves out, same shape as
        // authStore.restore()'s silent re-auth fallback. Not a user-facing
        // error (specs.md §10.16: "an update that arrives while offline").
        registration.update().catch(() => {})
      }, PERIODIC_UPDATE_CHECK_MS)
      // Never outlive the tab (tests, and a page that never unloads cleanly
      // otherwise leaking a repeating timer) — `beforeunload` is enough here
      // since there's nothing to persist first.
      window.addEventListener('beforeunload', () => clearInterval(intervalId))
    },
    onRegisterError: (error) => {
      // Unlike the periodic check above, a registration failure isn't
      // necessarily offline (could be a genuine deploy/manifest problem) —
      // logged per docs/error-handling.md §2's swallow floor, not toasted:
      // the user didn't cause this and can't act on it, and vite-plugin-pwa
      // itself decides whether to retry.
      console.warn('sw update: service worker registration failed', error)
    },
  })

  return {
    applyUpdate: () => updateServiceWorker(),
  }
}

let controller: SwUpdateController | undefined

/**
 * Registers the app's service worker for update prompts. Called once from
 * `main.tsx`. Idempotent so a stray second call (e.g. from a future test or
 * HMR edge case) can't register twice; safe to call in any environment —
 * `registerSW`'s own dev build is a no-op when `devOptions.enabled: false`
 * (vite.config.ts), and its build output already guards `'serviceWorker' in
 * navigator` internally, so this module doesn't need to repeat either check.
 */
export const initServiceWorkerUpdates = (): void => {
  if (controller) return
  controller = createSwUpdateController(registerSW)
}

/**
 * The action a future "reload" affordance calls. Exists as its own export
 * — rather than requiring a caller to thread `initServiceWorkerUpdates`'s
 * return value through — because nothing before this in the module graph
 * has a reference to the controller (see docs/wave-3/w.md for why no such
 * affordance is wired to it yet).
 */
export const applyServiceWorkerUpdate = (): Promise<void> =>
  controller?.applyUpdate() ?? Promise.resolve()
