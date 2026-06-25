import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
import { RequireAuth } from '@/features/auth/RequireAuth'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
])
