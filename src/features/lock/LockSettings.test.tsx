import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const enable = vi.fn()
const lock = vi.fn()
const reset = vi.fn()

let state: Record<string, unknown> = {}
vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: (selector: (s: unknown) => unknown) => selector(state),
}))

import { LockSettings } from '@/features/lock/LockSettings'

test('activating with a 4-digit PIN calls enable', async () => {
  state = { enabled: false, biometricAvailable: false, enable, lock, reset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.type(screen.getByLabelText(/pin/i), '1234')
  await user.click(screen.getByRole('button', { name: /activar/i }))
  expect(enable).toHaveBeenCalledWith('1234', false)
})

test('when enabled, "Lock now" re-locks', async () => {
  state = { enabled: true, biometricAvailable: false, enable, lock, reset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.click(screen.getByRole('button', { name: /lock now/i }))
  expect(lock).toHaveBeenCalled()
})

test('shows a Spanish, actionable error when enabling fails — never the raw message', async () => {
  const failingEnable = vi.fn().mockRejectedValue(new Error('lock: no session to protect'))
  state = { enabled: false, biometricAvailable: false, enable: failingEnable, lock, reset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.type(screen.getByLabelText(/pin/i), '1234')
  await user.click(screen.getByRole('button', { name: /activar/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /necesitas iniciar sesión antes de activar/i,
  )
  expect(screen.queryByText(/no session to protect/i)).not.toBeInTheDocument()
})

// Finding 5: "Desactivar" called `void reset()` directly, with no local
// try/catch — docs/error-handling.md §7 permits a bare `void action()` only
// when the store action self-catches, and reset() doesn't (resetVault()'s
// db.vault.delete can throw under the same storage conditions as finding 1).
// Give it the same local-handler shape "Activar lock" already has.
test('shows an actionable error when disabling the lock fails, instead of failing silently', async () => {
  const failingReset = vi.fn().mockRejectedValue(new Error('IDB blocked'))
  state = { enabled: true, biometricAvailable: false, enable, lock, reset: failingReset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.click(screen.getByRole('button', { name: /desactivar/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo desactivar/i)
})

test('"Desactivar" clears any previous error once it succeeds', async () => {
  const okReset = vi.fn().mockResolvedValue(undefined)
  state = { enabled: true, biometricAvailable: false, enable, lock, reset: okReset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.click(screen.getByRole('button', { name: /desactivar/i }))
  expect(okReset).toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
