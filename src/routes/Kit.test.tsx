import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kit } from '@/routes/Kit'

// LockSettings moved off this dev-only gallery onto the real profile sheet
// (src/features/profile/SecuritySection.tsx, specs.md §10.18) — it is no
// longer the only way to reach the PIN lock in a production build, so its
// own behavior is fully covered by src/features/lock/LockSettings.test.tsx
// and src/features/profile/SecuritySection.test.tsx. This just proves the
// gallery itself still mounts and renders its heading.
describe('Kit', () => {
  it('renders the shared UI kit gallery', () => {
    render(<Kit />)
    expect(screen.getByRole('heading', { name: /shared ui kit/i })).toBeInTheDocument()
  })
})
