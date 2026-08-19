import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
import { AppShell } from '@/routes/AppShell'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RouteErrorFallback } from '@/RouteErrorFallback'
import { SearchScreen } from '@/features/search/SearchScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'

const devRoutes = import.meta.env.DEV
  ? [
      {
        path: '/kit',
        lazy: async () => {
          const { Kit } = await import('@/routes/Kit')
          return { Component: Kit }
        },
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
