import { Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
import { AppShell } from '@/routes/AppShell'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { BootGate } from '@/features/boot/BootGate'
import { FirstSyncGate } from '@/features/sync/FirstSyncGate'
import { RouteErrorFallback } from '@/RouteErrorFallback'
import { SearchScreen } from '@/features/search/SearchScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { ScreenLoading } from '@/components/shared/ScreenLoading'
import { KitLazy } from '@/routes/KitLazy'
import { SettingsLazy } from '@/routes/SettingsLazy'

const devRoutes = import.meta.env.DEV
  ? [
      {
        path: '/kit',
        // react-router's own route-level `lazy` has no fallback slot of its own.
        element: (
          <Suspense fallback={<ScreenLoading />}>
            <KitLazy />
          </Suspense>
        ),
        errorElement: <RouteErrorFallback />,
      },
    ]
  : []

export const router = createBrowserRouter([
  {
    element: (
      <RequireAuth>
        <BootGate>
          <FirstSyncGate>
            <AppShell />
          </FirstSyncGate>
        </BootGate>
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Home />, errorElement: <RouteErrorFallback /> },
      { path: '/search', element: <SearchScreen />, errorElement: <RouteErrorFallback /> },
      { path: '/history', element: <HistoryScreen />, errorElement: <RouteErrorFallback /> },
    ],
  },
  {
    path: '/settings',
    element: (
      <RequireAuth>
        <BootGate>
          <FirstSyncGate>
            <Suspense fallback={<ScreenLoading />}>
              <SettingsLazy />
            </Suspense>
          </FirstSyncGate>
        </BootGate>
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
  },
  ...devRoutes,
])
