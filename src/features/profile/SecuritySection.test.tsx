import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SecuritySection } from '@/features/profile/SecuritySection'

// LockSettings' own behavior (enable/disable/re-lock, error copy) is fully
// covered by src/features/lock/LockSettings.test.tsx — this just proves
// this section really renders it, since that's the whole point of moving
// it here (specs.md §10.18).
describe('SecuritySection', () => {
  it('renders the real LockSettings controls, not a stub', () => {
    render(<SecuritySection />)
    expect(screen.getByRole('button', { name: /activar lock/i })).toBeInTheDocument()
  })
})
