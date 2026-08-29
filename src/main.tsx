import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/router'
import { AppLock } from '@/features/lock/AppLock'
import { SingleTabGuard } from '@/features/boot/SingleTabGuard'
import { LandscapeGuard } from '@/components/shared/LandscapeGuard'
import { AppErrorBoundary } from '@/AppErrorBoundary'
import { initServiceWorkerUpdates } from '@/lib/swUpdate'
import '@/lib/i18n'
import { syncStoredLocale } from '@/lib/i18n/syncStoredLocale'
import { syncStoredTheme } from '@/lib/syncStoredTheme'
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
      <LandscapeGuard />
      <SingleTabGuard>
        <AppLock>
          <RouterProvider router={router} />
        </AppLock>
      </SingleTabGuard>
    </AppErrorBoundary>
  </StrictMode>,
)
