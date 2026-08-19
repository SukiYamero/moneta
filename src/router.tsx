import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
import { RequireAuth } from '@/features/auth/RequireAuth'

const devRoutes = import.meta.env.DEV
  ? [
      {
        path: '/kit',
        lazy: async () => {
          const { Kit } = await import('@/routes/Kit')
          return { Component: Kit }
        },
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
  },
  ...devRoutes,
])
