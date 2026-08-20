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
        // React.lazy + Suspense (not react-router's own route-level `lazy`,
        // which has no fallback slot of its own) so a real Tier 1
        // `ScreenLoading` (specs.md §10.9) covers the module fetch instead
        // of leaving the route pending with nothing on screen.
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
    // Pathless layout route: BottomNav (via AppShell) persists across all
    // three tabs, so RequireAuth wraps the shell once instead of each
    // screen individually. errorElement here catches a failure in
    // RequireAuth/AppShell itself; each child keeps its own too, so a
    // crash in one screen doesn't take the persistent nav down with it.
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
    // `/settings` is its own `RequireAuth`-wrapped route, not a child of
    // the layout route above: it's not a bottom-nav tab (no `BottomNav` to
    // share), and its own mount/unmount is what closes the Profile sheet
    // that opened it — that sheet's state lives in `AppShell`, so
    // navigating away from `AppShell`'s subtree unmounts it for free
    // rather than needing an explicit close callback threaded through
    // `PreferencesSection` (specs.md §10.24).
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
