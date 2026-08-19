import { Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
import { AppShell } from '@/routes/AppShell'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RouteErrorFallback } from '@/RouteErrorFallback'
import { SearchScreen } from '@/features/search/SearchScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { ScreenLoading } from '@/components/shared/ScreenLoading'
import { KitLazy } from '@/routes/KitLazy'

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
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Home />, errorElement: <RouteErrorFallback /> },
      { path: '/search', element: <SearchScreen />, errorElement: <RouteErrorFallback /> },
      { path: '/history', element: <HistoryScreen />, errorElement: <RouteErrorFallback /> },
    ],
  },
  ...devRoutes,
])
