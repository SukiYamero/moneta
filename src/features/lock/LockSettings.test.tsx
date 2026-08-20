import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'
import type { ToastMessageKey } from '@/lib/toastStore'

// Resolved through the real i18next instance ('es', forced by
// src/test/setup.ts) rather than restated as a literal — same split
// `AppLock.test.tsx`'s own `T` helper already uses for toast copy.
const T = (key: Extract<ToastMessageKey, `lock:${string}`>): string => i18next.t(key)

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
  await user.type(screen.getByLabelText(T('lock:settings.pinLabel')), '1234')
  await user.click(screen.getByRole('button', { name: T('lock:settings.enableCta') }))
  expect(enable).toHaveBeenCalledWith('1234', false)
})

test('when enabled, "Lock now" re-locks', async () => {
  state = { enabled: true, biometricAvailable: false, enable, lock, reset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.click(screen.getByRole('button', { name: T('lock:settings.lockNowCta') }))
  expect(lock).toHaveBeenCalled()
})

test('shows an actionable error when enabling fails — never the raw message', async () => {
  const failingEnable = vi.fn().mockRejectedValue(new Error('lock: no session to protect'))
  state = { enabled: false, biometricAvailable: false, enable: failingEnable, lock, reset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.type(screen.getByLabelText(T('lock:settings.pinLabel')), '1234')
  await user.click(screen.getByRole('button', { name: T('lock:settings.enableCta') }))
  expect(await screen.findByRole('alert')).toHaveTextContent(T('lock:errors.noSession'))
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
  await user.click(screen.getByRole('button', { name: T('lock:settings.disableCta') }))
  expect(await screen.findByRole('alert')).toHaveTextContent(T('lock:errors.disableDefault'))
})

test('"Desactivar" clears any previous error once it succeeds', async () => {
  const okReset = vi.fn().mockResolvedValue(undefined)
  state = { enabled: true, biometricAvailable: false, enable, lock, reset: okReset }
  const user = userEvent.setup()
  render(<LockSettings />)
  await user.click(screen.getByRole('button', { name: T('lock:settings.disableCta') }))
  expect(okReset).toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
