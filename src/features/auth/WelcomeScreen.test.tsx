import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { useAuthStore } from '@/lib/authStore'
import { APP_NAME } from '@/lib/branding'

beforeEach(() => {
  useAuthStore.setState({ status: 'idle', user: null, session: null, drive: null, error: null })
})

describe('WelcomeScreen', () => {
  it('shows the brand name and the Google sign-in CTA', () => {
    render(<WelcomeScreen />)
    expect(screen.getByText(APP_NAME)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('calls the real authStore.login on click', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(<WelcomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  it('shows a busy state and disables the button while authenticating', () => {
    useAuthStore.setState({ status: 'authenticating' })
    render(<WelcomeScreen />)
    const button = screen.getByRole('button', { name: /conectando/i })
    expect(button).toBeDisabled()
  })

  it('shows a Spanish, actionable error when login fails — never the raw message', () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(<WelcomeScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent(/cancelaste el inicio de sesión/i)
    expect(screen.queryByText(/access_denied/i)).not.toBeInTheDocument()
  })

  it('falls back to a generic Spanish message for an unmapped error', () => {
    useAuthStore.setState({ status: 'error', error: 'auth: some_new_gis_error_code' })
    render(<WelcomeScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo iniciar sesión/i)
    expect(screen.queryByText(/some_new_gis_error_code/i)).not.toBeInTheDocument()
  })
})
