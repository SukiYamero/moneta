import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
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
    path: '/',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/search',
    element: (
      <RequireAuth>
        <SearchScreen />
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/history',
    element: (
      <RequireAuth>
        <HistoryScreen />
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
  },
  ...devRoutes,
])
