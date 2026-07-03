import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from '@/routes/Home'

describe('Home', () => {
  it('renders the app name and the lock settings', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Moneta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar lock/i })).toBeInTheDocument()
  })
})
