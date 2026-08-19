import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuthStore } from '@/lib/authStore'

beforeEach(() => {
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
  })
})

describe('RequireAuth', () => {
  it('shows the welcome screen when unauthenticated', () => {
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls login when the welcome screen button is clicked', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    await userEvent.click(screen.getByRole('button', { name: /google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  it('shows a welcome-screen error message when status is error', () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied')
  })

  it('shows the Drive permission screen right after login, before the app', () => {
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'pending' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /permitir y continuar/i })).toBeInTheDocument()
  })

  it('renders children once Drive sync is connected', () => {
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'connected' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders children once the Drive prompt is dismissed for the session', () => {
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'dismissed' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
