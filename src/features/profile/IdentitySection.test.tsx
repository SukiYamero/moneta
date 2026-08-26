import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/lib/authStore'
import { IdentitySection } from '@/features/profile/IdentitySection'

vi.mock('@/lib/outbox', () => ({ listPendingOperations: vi.fn() }))

import { listPendingOperations } from '@/lib/outbox'

const mListPending = vi.mocked(listPendingOperations)

beforeEach(() => {
  mListPending.mockResolvedValue([])
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'connected',
  })
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

  // With Drive connected there is nothing at risk to warn about, so
  // sign-out runs directly with no modal.
  it('calls the real authStore.logout directly when Drive is connected', async () => {
    const logout = vi.fn()
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
      driveOptIn: 'connected',
      logout,
    })
    render(<IdentitySection />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(logout).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('signs out directly, with no modal, when Drive is not connected but nothing is unsynced', async () => {
    const logout = vi.fn()
    mListPending.mockResolvedValue([])
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
      driveOptIn: 'pending',
      logout,
    })
    render(<IdentitySection />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(logout).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // The confirmation modal: shown only when there is unsynced local data
  // and Drive is not connected, names the real quantity, and its primary
  // action signs out while keeping the data.
  it('shows a confirm modal naming the real quantity when unsynced data exists and Drive is not connected', async () => {
    const logout = vi.fn()
    mListPending.mockResolvedValue([
      {
        id: '1',
        entity: 'movimiento',
        entityId: 'm1',
        hlc: 'x',
        basedOn: null,
        device: 'd',
        enqueuedAt: 0,
        operation: { entity: 'movimiento', op: 'put', payload: {} as never },
      },
    ])
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
      driveOptIn: 'dismissed',
      logout,
    })
    render(<IdentitySection />)

    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/1 movimiento/i)).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('cancelling the confirm modal keeps the user signed in', async () => {
    const logout = vi.fn()
    mListPending.mockResolvedValue([
      {
        id: '1',
        entity: 'movimiento',
        entityId: 'm1',
        hlc: 'x',
        basedOn: null,
        device: 'd',
        enqueuedAt: 0,
        operation: { entity: 'movimiento', op: 'put', payload: {} as never },
      },
    ])
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
      driveOptIn: 'pending',
      logout,
    })
    render(<IdentitySection />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(logout).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirming the modal signs out and keeps the data', async () => {
    const logout = vi.fn()
    mListPending.mockResolvedValue([
      {
        id: '1',
        entity: 'movimiento',
        entityId: 'm1',
        hlc: 'x',
        basedOn: null,
        device: 'd',
        enqueuedAt: 0,
        operation: { entity: 'movimiento', op: 'put', payload: {} as never },
      },
    ])
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'alex@example.com', name: 'Alex Rivera' },
      driveOptIn: 'pending',
      logout,
    })
    render(<IdentitySection />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: /cerrar sesión/i }))

    expect(logout).toHaveBeenCalledOnce()
  })

  it('shows a loading placeholder instead of a blank name when authenticated with no profile yet', () => {
    useAuthStore.setState({ status: 'authenticated', user: null })
    render(<IdentitySection />)
    expect(screen.getByText(/cargando cuenta/i)).toBeInTheDocument()
  })
})
