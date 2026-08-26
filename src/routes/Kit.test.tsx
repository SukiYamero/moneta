import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kit } from '@/routes/Kit'

describe('Kit', () => {
  it('renders the shared UI kit gallery', () => {
    render(<Kit />)
    expect(screen.getByRole('heading', { name: /shared ui kit/i })).toBeInTheDocument()
  })
})
