import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/router'
import { AppLock } from '@/features/lock/AppLock'
import { AppErrorBoundary } from '@/AppErrorBoundary'
import { initServiceWorkerUpdates } from '@/lib/swUpdate'
import '@/lib/i18n'
import { syncStoredLocale } from '@/lib/i18n/syncStoredLocale'
import '@/styles/index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

initServiceWorkerUpdates()
syncStoredLocale()

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppLock>
        <RouterProvider router={router} />
      </AppLock>
    </AppErrorBoundary>
  </StrictMode>,
)
