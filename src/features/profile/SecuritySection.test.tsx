import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'

let authStatus = 'authenticated'
let lockEnabled = false

vi.mock('@/lib/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      get status() {
        return authStatus
      },
    }),
}))
vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: (selector: (s: unknown) => unknown) =>
    selector({
      get enabled() {
        return lockEnabled
      },
      lock: vi.fn(),
      reset: vi.fn(),
      enable: vi.fn(),
      biometricAvailable: false,
    }),
}))

import { SecuritySection } from '@/features/profile/SecuritySection'

beforeEach(() => {
  authStatus = 'authenticated'
  lockEnabled = false
})

// specs.md §10.2.1 / §12: a guest must never be shown a lock control that
// can only fail — verified here at the section level, closing the
// backlog item CONFIRMED by the operator (§11, 2026-08-20).
describe.each(['guest', 'idle', 'authenticating', 'error'])('when status is %s', (status) => {
  it('renders nothing', () => {
    authStatus = status
    const { container } = render(<SecuritySection />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('when authenticated', () => {
  it('shows the lock row with an "off" status chip when the lock is disabled', () => {
    render(<SecuritySection />)
    expect(screen.getByText(i18next.t('lock:settings.panelTitle'))).toBeInTheDocument()
    expect(screen.getByText(i18next.t('lock:settings.statusInactive'))).toBeInTheDocument()
  })

  it('shows an "on" status chip when the lock is enabled', () => {
    lockEnabled = true
    render(<SecuritySection />)
    expect(screen.getByText(i18next.t('lock:settings.statusActive'))).toBeInTheDocument()
  })

  it('opens the full-screen LockSettings panel on tap', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)
    await user.click(
      screen.getByRole('button', { name: new RegExp(i18next.t('lock:settings.panelTitle')) }),
    )
    expect(screen.getByText(i18next.t('lock:settings.panelSubtitle'))).toBeInTheDocument()
  })
})
