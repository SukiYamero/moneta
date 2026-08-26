import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kit } from '@/routes/Kit'

// LockSettings behavior is covered where it's actually reachable in
// production (LockSettings.test.tsx, SecuritySection.test.tsx); this just
// proves the dev-only gallery itself still mounts.
describe('Kit', () => {
  it('renders the shared UI kit gallery', () => {
    render(<Kit />)
    expect(screen.getByRole('heading', { name: /shared ui kit/i })).toBeInTheDocument()
  })
})
