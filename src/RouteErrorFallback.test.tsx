import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { RouteErrorFallback } from '@/RouteErrorFallback'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderAtBrokenRoute() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        loader() {
          throw new Error('loader exploded')
        },
        // A real page component is irrelevant here — the loader throws
        // before it would ever render.
        Component: () => null,
        errorElement: <RouteErrorFallback />,
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

describe('RouteErrorFallback', () => {
  it('renders a Spanish fallback with role="alert" instead of the crashed route', async () => {
    // The data router resolves the throwing loader asynchronously, even in
    // memory mode — findByRole waits for that transition to settle.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAtBrokenRoute()
    expect(await screen.findByRole('alert')).toHaveTextContent(/problema inesperado/i)
  })

  it('logs the route error, never rendering it raw', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAtBrokenRoute()
    await screen.findByRole('alert')
    expect(errorSpy).toHaveBeenCalledWith('[RouteErrorFallback]', expect.any(Error))
    expect(screen.queryByText(/loader exploded/i)).not.toBeInTheDocument()
  })
})
