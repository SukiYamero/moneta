import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/routes/AppShell'
import { Home } from '@/routes/Home'
import { SearchScreen } from '@/features/search/SearchScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { APP_NAME } from '@/lib/branding'

// Mirrors src/router.tsx's shape — a pathless layout route (AppShell) with
// absolute-path children — without RequireAuth or browser history. That
// nesting pattern (needed so BottomNav mounts once instead of per-screen,
// docs/wave-2/track-l.md) is the one thing reading router.tsx's source
// can't confirm actually resolves at runtime; this proves it does, for all
// three tabs.
const renderAt = (initialPath: string) => {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Home /> },
          { path: '/search', element: <SearchScreen /> },
          { path: '/history', element: <HistoryScreen /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(<RouterProvider router={router} />)
}

describe('AppShell routing', () => {
  it('resolves / to Home with BottomNav mounted', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: APP_NAME })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('aria-current', 'page')
  })

  it('resolves /search to SearchScreen with BottomNav mounted', async () => {
    renderAt('/search')
    expect(await screen.findByRole('heading', { name: /buscar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('aria-current', 'page')
  })

  it('resolves /history to HistoryScreen with BottomNav mounted', async () => {
    renderAt('/history')
    expect(await screen.findByRole('heading', { name: /historial/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('aria-current', 'page')
  })
})
