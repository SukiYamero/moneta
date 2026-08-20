import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/routes/AppShell'
import { Home } from '@/routes/Home'
import { RouteErrorFallback } from '@/RouteErrorFallback'
import { SearchScreen } from '@/features/search/SearchScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { useMovimientoSheetStore } from '@/features/movimientos'

const Bomb = () => {
  throw new Error('boom')
}

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

describe('AppShell layout', () => {
  // BottomNav and Toaster both size their clearance off --bottom-nav-clearance
  // (src/styles/index.css) so a change to --bottom-nav-height propagates
  // everywhere at once. The scroll pane reserving a hardcoded pb-30 instead
  // would silently drift from that token (e.g. once safe-area-inset-bottom is
  // non-zero, 120px static falls short of the nav's actual 96px + inset).
  it('reserves scroll-pane clearance via the --bottom-nav-clearance token, not a hardcoded value', () => {
    const router = createMemoryRouter(
      [{ element: <AppShell />, children: [{ index: true, element: <div>content</div> }] }],
      { initialEntries: ['/'] },
    )
    const { container } = render(<RouterProvider router={router} />)
    const scrollPane = container.querySelector('.overflow-y-auto')
    expect(scrollPane?.className).toMatch(/pb-\(--bottom-nav-clearance\)/)
  })
})

describe('AppShell resilience', () => {
  // src/router.tsx gives each child its own errorElement precisely so one
  // screen's crash doesn't take the persistent nav down with it — this is
  // the one part of that claim that reading router.tsx's source can't
  // confirm actually holds at runtime (react-router error boundaries are
  // per-segment, but that's a fact about react-router, not this codebase,
  // and worth proving directly rather than trusting by inspection).
  it('keeps BottomNav mounted when the active screen throws during render', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter(
      [
        {
          element: <AppShell />,
          children: [{ index: true, element: <Bomb />, errorElement: <RouteErrorFallback /> }],
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    consoleError.mockRestore()
  })
})

describe('AppShell routing', () => {
  it('resolves / to Home with BottomNav mounted', async () => {
    renderAt('/')
    // Every route needs exactly one accessible heading — asserting *that*
    // is the invariant worth protecting, not any specific text: Home's <h1>
    // is its greeting (the design's actual subject for this screen), which
    // is real content, not a placeholder, and will keep changing with it
    // (e.g. by time of day, by user). Pinning specific text here would tie
    // this shell-routing test to a content decision Track E2 owns.
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
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

describe('AppShell — the movement sheets (specs.md §10.23)', () => {
  it('the FAB opens AddMovimientoSheet, mounted once beside ProfileSheet', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
    renderAt('/')
    await screen.findByRole('heading', { level: 1 })

    await user.click(screen.getByRole('button', { name: /agregar movimiento/i }))

    expect(screen.getByRole('dialog', { name: /agregar movimiento/i })).toBeInTheDocument()
  })
})
