import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kit } from '@/routes/Kit'

// LockSettings moved off Home (the only production route) onto this
// dev-only page — it is now the sole way to enable/disable the PIN lock,
// so its presence here is load-bearing, not decorative (docs/wave-2-plan.md
// §3 item 1). LockSettings' own behavior is fully covered by
// src/features/lock/LockSettings.test.tsx; this just proves it still mounts
// and renders here.
describe('Kit', () => {
  it('renders LockSettings', () => {
    render(<Kit />)
    expect(screen.getByRole('button', { name: /activar lock/i })).toBeInTheDocument()
  })
})
