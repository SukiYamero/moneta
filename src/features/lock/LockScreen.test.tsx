import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

const unlockPin = vi.fn().mockResolvedValue(undefined)
const unlockBiometric = vi.fn()
const unlockGuest = vi.fn().mockResolvedValue(undefined)
const reset = vi.fn()
const clearError = vi.fn()
let error: string | null = null
let biometricEnrolled = false
// Which credential is gating the locked phase (specs.md §10.33) — LockScreen
// dispatches on this, not authStore.status, because the cold-start guest
// gate (lockStore.init()) can lock the app before authStore has resolved
// anything at all.
let lockKind: 'account' | 'guest' = 'account'

beforeEach(() => {
  vi.clearAllMocks()
  unlockPin.mockResolvedValue(undefined)
  unlockGuest.mockResolvedValue(undefined)
  error = null
  biometricEnrolled = false
  lockKind = 'account'
})
vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: (selector: (s: unknown) => unknown) =>
    selector({
      phase: 'locked',
      get lockKind() {
        return lockKind
      },
      biometricAvailable: false,
      get biometricEnrolled() {
        return biometricEnrolled
      },
      get error() {
        return error
      },
      unlockPin,
      unlockBiometric,
      unlockGuest,
      reset,
      clearError,
    }),
}))

import LockScreen from '@/features/lock/LockScreen'

test('entering a 4-digit PIN auto-submits to unlockPin', async () => {
  const user = userEvent.setup()
  render(<LockScreen />)
  await user.type(screen.getByLabelText(T('lock:screen.pinLabel')), '1234')
  await waitFor(() => expect(unlockPin).toHaveBeenCalledWith('1234'))
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

test('tapping "Olvidé mi PIN" opens a confirm dialog, never wipes directly', async () => {
  const user = userEvent.setup()
  render(<LockScreen />)
  await user.click(screen.getByRole('button', { name: T('lock:screen.forgotCta') }))
  expect(screen.getByText(T('lock:forgotConfirm.title'))).toBeInTheDocument()
  expect(reset).not.toHaveBeenCalled()
})

test('confirming the forgot-PIN dialog wipes the vault via the existing reset() action', async () => {
  const user = userEvent.setup()
  render(<LockScreen />)
  await user.click(screen.getByRole('button', { name: T('lock:screen.forgotCta') }))
  await user.click(screen.getByRole('button', { name: T('lock:forgotConfirm.confirmCta') }))
  expect(reset).toHaveBeenCalled()
})

test('cancelling the forgot-PIN dialog leaves the vault untouched', async () => {
  const user = userEvent.setup()
  render(<LockScreen />)
  await user.click(screen.getByRole('button', { name: T('lock:screen.forgotCta') }))
  await user.click(screen.getByRole('button', { name: T('lock:forgotConfirm.cancelCta') }))
  expect(reset).not.toHaveBeenCalled()
  expect(screen.queryByText(T('lock:forgotConfirm.title'))).not.toBeInTheDocument()
})

// specs.md §10.2.1: a guest never has a PIN vault — the guest branch is
// biometric-only, no keypad, no "Olvidé mi PIN" (there is nothing to wipe
// that would help — the credential gates the UI, not a cryptographic
// boundary).
test('a guest never sees the PIN keypad or "Olvidé mi PIN" — biometric only', () => {
  lockKind = 'guest'
  render(<LockScreen />)
  expect(screen.queryByLabelText(T('lock:screen.pinLabel'))).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: T('lock:screen.forgotCta') })).not.toBeInTheDocument()
  expect(screen.getByText(T('lock:screen.guestTitle'))).toBeInTheDocument()
})

test('a guest lock screen tries the biometric ceremony once on mount', () => {
  lockKind = 'guest'
  render(<LockScreen />)
  expect(unlockGuest).toHaveBeenCalledOnce()
})

test('a guest can retry the biometric ceremony', async () => {
  lockKind = 'guest'
  const user = userEvent.setup()
  render(<LockScreen />)
  unlockGuest.mockClear()
  await user.click(screen.getByRole('button', { name: T('lock:screen.guestRetryCta') }))
  expect(unlockGuest).toHaveBeenCalledOnce()
})

test('a guest sees an actionable error for a failed biometric attempt', () => {
  lockKind = 'guest'
  error = 'lock: guest biometric unavailable'
  render(<LockScreen />)
  expect(screen.getByRole('alert')).toHaveTextContent(T('lock:errors.biometricUnavailable'))
})
