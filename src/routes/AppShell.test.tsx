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
  it('reserves scroll-pane clearance via the --bottom-nav-clearance token, not a hardcoded value', () => {
    const router = createMemoryRouter(
      [{ element: <AppShell />, children: [{ index: true, element: <div>content</div> }] }],
      { initialEntries: ['/'] },
    )
    const { container } = render(<RouterProvider router={router} />)
    const scrollPane = container.querySelector('.overflow-y-auto')
    expect(scrollPane?.className).toMatch(/pb-\(--bottom-nav-clearance\)/)
  })

  // jsdom doesn't run layout, so this pins the class shape, not pixel behavior.
  it('roots the shell at a definite h-full, not a min-h-full floor or min-h-dvh', () => {
    const { container } = render(
      <RouterProvider
        router={createMemoryRouter(
          [{ element: <AppShell />, children: [{ index: true, element: <div>content</div> }] }],
          { initialEntries: ['/'] },
        )}
      />,
    )
    const root = container.firstElementChild
    expect(root?.className).toMatch(/(^|\s)h-full(\s|$)/)
    expect(root?.className).not.toMatch(/min-h-full/)
    expect(root?.className).not.toMatch(/min-h-dvh/)
  })

  it('contains overscroll on the scroll pane', () => {
    const { container } = render(
      <RouterProvider
        router={createMemoryRouter(
          [{ element: <AppShell />, children: [{ index: true, element: <div>content</div> }] }],
          { initialEntries: ['/'] },
        )}
      />,
    )
    const scrollPane = container.querySelector('.overflow-y-auto')
    expect(scrollPane?.className).toMatch(/overscroll-y-contain/)
  })
})

describe('AppShell resilience', () => {
  // react-router's error boundaries are per-segment.
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

describe('AppShell — the movement sheets', () => {
  it('the FAB opens AddMovimientoSheet, mounted once beside ProfileSheet', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
    renderAt('/')
    await screen.findByRole('heading', { level: 1 })

    await user.click(screen.getByRole('button', { name: /agregar movimiento/i }))

    expect(screen.getByRole('dialog', { name: /agregar movimiento/i })).toBeInTheDocument()
  })
})
