import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  await user.type(screen.getByLabelText(/pin/i), '1234')
  await user.click(screen.getByRole('button', { name: /unlock/i }))
  expect(unlockPin).toHaveBeenCalledWith('1234')
})

test('shows a Spanish, actionable error for a wrong PIN — never the raw message', () => {
  error = 'lock: wrong pin'
  render(<LockScreen />)
  expect(screen.getByRole('alert')).toHaveTextContent(/pin incorrecto/i)
  expect(screen.queryByText(/lock: wrong pin/i)).not.toBeInTheDocument()
})

// Finding 9: the biometric button must reflect whether *this vault*
// enrolled biometrics, not just platform capability — offering it to a
// PIN-only user always fails with a misleading "not available on this
// device" message, even though the device does support it.
test('does not offer biometric unlock when this vault never enrolled it', () => {
  biometricEnrolled = false
  render(<LockScreen />)
  expect(screen.queryByRole('button', { name: /biometr/i })).not.toBeInTheDocument()
})

test('offers biometric unlock once this vault has biometrics enrolled', () => {
  biometricEnrolled = true
  render(<LockScreen />)
  expect(screen.getByRole('button', { name: /biometr/i })).toBeInTheDocument()
})
