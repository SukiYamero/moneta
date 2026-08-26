import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useAuthStore } from '@/lib/authStore'
import { __clearRegistryForTests } from '@/lib/profiles'
import { ProfileSheet } from '@/features/profile/ProfileSheet'

beforeEach(() => {
  useAuthStore.setState({ status: 'guest', user: null, session: null, drive: null, error: null })
})

afterEach(async () => {
  await __clearRegistryForTests()
})

describe('ProfileSheet', () => {
  it('renders nothing when closed', () => {
    render(<ProfileSheet open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a dialog carrying every section heading', async () => {
    // Security only renders for a signed-in account: a guest never sees
    // a lock control that could only fail.
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 9_999_999_999_000 },
    })
    render(<ProfileSheet open onClose={() => {}} />, { wrapper: MemoryRouter })
    const dialog = screen.getByRole('dialog', { name: 'Perfil' })
    expect(dialog).toBeInTheDocument()

    expect(screen.getByText('Cuenta')).toBeInTheDocument()
    expect(await screen.findByText('Perfiles')).toBeInTheDocument()
    expect(screen.getByText('Seguridad')).toBeInTheDocument()
    expect(screen.getByText('Datos')).toBeInTheDocument()
    expect(screen.getByText('Preferencias')).toBeInTheDocument()
  })
})
