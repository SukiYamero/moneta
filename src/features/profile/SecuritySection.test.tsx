import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'

let authStatus = 'authenticated'
let lockEnabled = false
let biometricAvailable = false
let guestLockEnabled = false

const initGuestLock = vi.fn()
const enableGuestLock = vi.fn()
const disableGuestLock = vi.fn()

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
      get biometricAvailable() {
        return biometricAvailable
      },
      get guestLockEnabled() {
        return guestLockEnabled
      },
      lock: vi.fn(),
      reset: vi.fn(),
      enable: vi.fn(),
      initGuestLock,
      enableGuestLock,
      disableGuestLock,
    }),
}))

import { SecuritySection } from '@/features/profile/SecuritySection'

beforeEach(() => {
  vi.clearAllMocks()
  authStatus = 'authenticated'
  lockEnabled = false
  biometricAvailable = false
  guestLockEnabled = false
  enableGuestLock.mockResolvedValue(undefined)
  disableGuestLock.mockResolvedValue(undefined)
})

describe.each(['idle', 'authenticating', 'error'])('when status is %s', (status) => {
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

describe('when a guest', () => {
  beforeEach(() => {
    authStatus = 'guest'
  })

  it('renders nothing when the device has no biometric capability', () => {
    biometricAvailable = false
    const { container } = render(<SecuritySection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the biometric-lock row when the device supports it', () => {
    biometricAvailable = true
    render(<SecuritySection />)
    expect(screen.getByText(i18next.t('lock:settings.guestRowLabel'))).toBeInTheDocument()
    expect(screen.queryByText(i18next.t('lock:settings.panelTitle'))).not.toBeInTheDocument()
  })

  it('refreshes the enrollment state on mount', async () => {
    biometricAvailable = true
    render(<SecuritySection />)
    await waitFor(() => expect(initGuestLock).toHaveBeenCalled())
  })

  it('enabling the toggle enrolls the guest biometric credential', async () => {
    biometricAvailable = true
    const user = userEvent.setup()
    render(<SecuritySection />)
    await user.click(screen.getByRole('switch', { name: i18next.t('lock:settings.guestRowLabel') }))
    expect(enableGuestLock).toHaveBeenCalled()
  })

  it('disabling the toggle clears the enrollment', async () => {
    biometricAvailable = true
    guestLockEnabled = true
    const user = userEvent.setup()
    render(<SecuritySection />)
    await user.click(screen.getByRole('switch', { name: i18next.t('lock:settings.guestRowLabel') }))
    expect(disableGuestLock).toHaveBeenCalled()
  })

  it('shows an actionable error when enrollment fails', async () => {
    biometricAvailable = true
    enableGuestLock.mockRejectedValue(new Error('lock: guest biometric unavailable'))
    const user = userEvent.setup()
    render(<SecuritySection />)
    await user.click(screen.getByRole('switch', { name: i18next.t('lock:settings.guestRowLabel') }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
