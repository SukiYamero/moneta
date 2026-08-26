import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '@/lib/authStore'
import { HomeHeader } from '@/features/home/HomeHeader'

describe('HomeHeader', () => {
  it('gives the notification bell a real 44px touch target', () => {
    useAuthStore.setState({ user: { email: 'alex@example.com', name: 'Alex Rivera' } })
    render(<HomeHeader />)

    expect(screen.getByRole('button', { name: /notificaciones/i })).toHaveClass(
      'min-h-11',
      'min-w-11',
    )
  })

  it('keeps the visible pill at its designed 42px size, growing only the tap target', () => {
    useAuthStore.setState({ user: { email: 'alex@example.com', name: 'Alex Rivera' } })
    render(<HomeHeader />)

    const button = screen.getByRole('button', { name: /notificaciones/i })
    expect(button).not.toHaveClass('bg-card')
    expect(button.querySelector('span')).toHaveClass('size-10.5', 'bg-card')
  })

  // A guest has no Google profile — `user` stays null past RequireAuth's
  // guard. The header must show an honest guest label, not a blank name.
  it('shows an honest guest label instead of a blank name for a guest session', () => {
    useAuthStore.setState({ status: 'guest', user: null })
    render(<HomeHeader />)

    expect(screen.getByText('Invitado')).toBeInTheDocument()
  })
})
