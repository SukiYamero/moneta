import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'
import type { ToastMessageKey } from '@/lib/toastStore'

// Resolved through the real i18next instance ('es', forced by
// src/test/setup.ts) rather than restated as a literal — a copy reword in
// the `lock` namespace fails the build in resources.test.ts's key-parity
// check, not silently here (same split `AppLock.test.tsx`'s own `T` helper
// already uses for toast copy — `ToastMessageKey` spans every namespace,
// not just `toast`, so it types this `lock:`-prefixed key too).
const T = (key: Extract<ToastMessageKey, `lock:${string}`>): string => i18next.t(key)

const unlockPin = vi.fn()
let error: string | null = null
let biometricEnrolled = false

beforeEach(() => {
  error = null
  biometricEnrolled = false
})
vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: (selector: (s: unknown) => unknown) =>
    selector({
      phase: 'locked',
      biometricAvailable: false,
      get biometricEnrolled() {
        return biometricEnrolled
      },
      get error() {
        return error
      },
      unlockPin,
      unlockBiometric: vi.fn(),
    }),
}))

import LockScreen from '@/features/lock/LockScreen'

test('entering a 4-digit PIN calls unlockPin', async () => {
  const user = userEvent.setup()
  render(<LockScreen />)
  await user.type(screen.getByLabelText(T('lock:screen.pinLabel')), '1234')
  await user.click(screen.getByRole('button', { name: T('lock:screen.unlockCta') }))
  expect(unlockPin).toHaveBeenCalledWith('1234')
})

test('shows an actionable error for a wrong PIN — never the raw message', () => {
  error = 'lock: wrong pin'
  render(<LockScreen />)
  expect(screen.getByRole('alert')).toHaveTextContent(T('lock:errors.wrongPin'))
  expect(screen.queryByText(/lock: wrong pin/i)).not.toBeInTheDocument()
})

// Finding 9: the biometric button must reflect whether *this vault*
// enrolled biometrics, not just platform capability — offering it to a
// PIN-only user always fails with a misleading "not available on this
// device" message, even though the device does support it.
test('does not offer biometric unlock when this vault never enrolled it', () => {
  biometricEnrolled = false
  render(<LockScreen />)
  expect(
    screen.queryByRole('button', { name: T('lock:screen.biometricCta') }),
  ).not.toBeInTheDocument()
})

test('offers biometric unlock once this vault has biometrics enrolled', () => {
  biometricEnrolled = true
  render(<LockScreen />)
  expect(screen.getByRole('button', { name: T('lock:screen.biometricCta') })).toBeInTheDocument()
})
