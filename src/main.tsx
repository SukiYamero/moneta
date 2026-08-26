import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/router'
import { AppLock } from '@/features/lock/AppLock'
import { LandscapeGuard } from '@/components/shared/LandscapeGuard'
import { AppErrorBoundary } from '@/AppErrorBoundary'
import { initServiceWorkerUpdates } from '@/lib/swUpdate'
import '@/lib/i18n'
import { syncStoredLocale } from '@/lib/i18n/syncStoredLocale'
import { syncStoredTheme } from '@/lib/syncStoredTheme'
// Side-effect import: attaches the authStore subscription that starts/stops
// the Drive sync triggers (specs.md §10.26 §2) — see that module's own
// comment for why this is a reactive subscription rather than explicit
// calls inside authStore.ts's own actions.
import '@/lib/sync/syncSession'
import '@/styles/index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

initServiceWorkerUpdates()
syncStoredLocale()
syncStoredTheme()

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      {/* Above AppLock and the router, not inside AppShell: the app is
          portrait-only everywhere, and the screens that most need saying so
          (the PIN lock, the auth screens, /settings) all mount outside
          AppShell — specs.md §10.53 shipped it there and said so rather
          than leaving the gap unnamed. */}
      <LandscapeGuard />
      <AppLock>
        <RouterProvider router={router} />
      </AppLock>
    </AppErrorBoundary>
  </StrictMode>,
)
