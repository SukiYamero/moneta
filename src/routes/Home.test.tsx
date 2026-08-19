import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from '@/routes/Home'
import { APP_NAME } from '@/lib/branding'

describe('Home', () => {
  it('renders the app name', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: APP_NAME })).toBeInTheDocument()
  })
})
