import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorBoundary } from '@/AppErrorBoundary'

const Bomb = (): never => {
  throw new Error('boom')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AppErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>fine</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })

  it('renders a Spanish fallback with role="alert" instead of crashing the tree', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/problema inesperado/i)
  })

  it('logs the caught error and component stack, never rendering them raw', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[AppErrorBoundary]',
      expect.any(Error),
      expect.any(String),
    )
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument()
  })
})
