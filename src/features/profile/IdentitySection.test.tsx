import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/lib/authStore'
import { IdentitySection } from '@/features/profile/IdentitySection'

beforeEach(() => {
  useAuthStore.setState({ status: 'idle', user: null, session: null, drive: null, error: null })
})

describe('IdentitySection', () => {
  it('shows the guest label and a Google sign-in row for a guest session', () => {
    useAuthStore.setState({ status: 'guest', user: null })
    render(<IdentitySection />)
    expect(screen.getByText('Invitado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('calls the real authStore.login when the sign-in row is tapped', async () => {
    const login = vi.fn()
    useAuthStore.setState({ status: 'guest', user: null, login })
    render(<IdentitySection />)
    await userEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  it('shows a busy state while authenticating', () => {
    useAuthStore.setState({ status: 'authenticating' })
    render(<IdentitySection />)
    expect(screen.getByRole('button', { name: /conectando/i })).toBeDisabled()
  })

  it('shows a Spanish, actionable error when sign-in fails — never the raw message', () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(<IdentitySection />)
    expect(screen.getByRole('alert')).toHaveTextContent(/cancelaste el inicio de sesión/i)
    expect(screen.queryByText(/access_denied/i)).not.toBeInTheDocument()
  })

  it('shows the real Google name/email and a sign-out control for an authenticated session', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
    })
    render(<IdentitySection />)
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument()
  })

  it('calls the real authStore.logout when signing out', async () => {
    const logout = vi.fn()
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
      logout,
    })
    render(<IdentitySection />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('shows a loading placeholder instead of a blank name when authenticated with no profile yet', () => {
    useAuthStore.setState({ status: 'authenticated', user: null })
    render(<IdentitySection />)
    expect(screen.getByText(/cargando cuenta/i)).toBeInTheDocument()
  })
})
