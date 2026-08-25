import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestSignInButton } from '@/features/auth/GuestSignInButton'

describe('GuestSignInButton', () => {
  it('renders its label and calls onClick when tapped', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <GuestSignInButton onClick={onClick} disabled={false}>
        Continuar como invitado
      </GuestSignInButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Continuar como invitado' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disables the button when disabled is true', () => {
    render(
      <GuestSignInButton onClick={() => {}} disabled>
        Continuar como invitado
      </GuestSignInButton>,
    )

    expect(screen.getByRole('button', { name: 'Continuar como invitado' })).toBeDisabled()
  })
})
