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
    // "Activar bloqueo" — the lock's copy is now real, i18n-routed Spanish
    // (specs.md §10.24 Prerequisite 4), not the earlier hardcoded "Activar
    // lock".
    expect(screen.getByRole('button', { name: /activar bloqueo/i })).toBeInTheDocument()
  })
})
