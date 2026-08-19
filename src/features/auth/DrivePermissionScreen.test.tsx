import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'
import { useAuthStore } from '@/lib/authStore'
import { APP_NAME } from '@/lib/branding'

beforeEach(() => {
  useAuthStore.setState({
    status: 'authenticated',
    user: { email: 'a@b.com', name: 'Ana' },
    session: { accessToken: 'tok', expiresAt: 1 },
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
  })
})

describe('DrivePermissionScreen', () => {
  it('explains the one Drive permission and shows the brand name', () => {
    render(<DrivePermissionScreen />)
    expect(screen.getAllByText(new RegExp(APP_NAME)).length).toBeGreaterThan(0)
    expect(screen.getByText(/crear y editar sus propios archivos/i)).toBeInTheDocument()
    expect(screen.queryByText(/no accede a tus otros archivos/i)).not.toBeInTheDocument()
  })

  it('shows the reassurance line near "Ahora no"', () => {
    render(<DrivePermissionScreen />)
    expect(screen.getByText(/puedes continuar sin conectar tu drive/i)).toBeInTheDocument()
  })

  it('calls authStore.connectDrive when "Permitir y continuar" is pressed', async () => {
    const connectDrive = vi.fn()
    useAuthStore.setState({ connectDrive })
    render(<DrivePermissionScreen />)
    await userEvent.click(screen.getByRole('button', { name: /permitir y continuar/i }))
    expect(connectDrive).toHaveBeenCalledOnce()
  })

  it('calls authStore.dismissDrive when "Ahora no" is pressed', async () => {
    const dismissDrive = vi.fn()
    useAuthStore.setState({ dismissDrive })
    render(<DrivePermissionScreen />)
    await userEvent.click(screen.getByRole('button', { name: /ahora no/i }))
    expect(dismissDrive).toHaveBeenCalledOnce()
  })

  it('shows a busy overlay while connecting and disables both actions', () => {
    useAuthStore.setState({ driveConnecting: true })
    render(<DrivePermissionScreen />)
    expect(screen.getByText(/conectando con tu drive/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /permitir y continuar/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeDisabled()
  })

  it('shows a Spanish, actionable inline error on failure and stays usable — never the raw message', () => {
    useAuthStore.setState({ driveError: 'drive: list 403' })
    render(<DrivePermissionScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo conectar con drive/i)
    expect(screen.queryByText(/403/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /permitir y continuar/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeEnabled()
  })
})
