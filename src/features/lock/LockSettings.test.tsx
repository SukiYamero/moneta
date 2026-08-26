import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'
import type { ToastMessageKey } from '@/lib/toastStore'

const T = (key: Extract<ToastMessageKey, `lock:${string}`>): string => i18next.t(key)

const lockFn = vi.fn()
const reset = vi.fn()
const enable = vi.fn()

let state: Record<string, unknown> = {}
vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: (selector: (s: unknown) => unknown) => selector(state),
}))

import { LockSettings } from '@/features/lock/LockSettings'

const baseState = { enabled: false, biometricAvailable: false, lock: lockFn, reset, enable }

test('turning the toggle on opens PIN setup instead of enabling directly', async () => {
  state = { ...baseState }
  const user = userEvent.setup()
  render(<LockSettings open onClose={vi.fn()} />)
  await user.click(screen.getByRole('switch', { name: T('lock:settings.pinRowLabel') }))
  expect(screen.getByText(T('lock:setup.titleCreate'))).toBeInTheDocument()
  expect(enable).not.toHaveBeenCalled()
})

test('when enabled, "Cambiar PIN" opens PIN setup in change mode', async () => {
  state = { ...baseState, enabled: true }
  const user = userEvent.setup()
  render(<LockSettings open onClose={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: T('lock:settings.changePinCta') }))
  expect(screen.getByRole('dialog', { name: T('lock:setup.kickerChange') })).toBeInTheDocument()
})

test('when enabled, "Bloquear ahora" re-locks', async () => {
  state = { ...baseState, enabled: true }
  const user = userEvent.setup()
  render(<LockSettings open onClose={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: T('lock:settings.lockNowCta') }))
  expect(lockFn).toHaveBeenCalled()
})

test('turning the toggle off disables the lock via reset()', async () => {
  state = { ...baseState, enabled: true }
  const user = userEvent.setup()
  render(<LockSettings open onClose={vi.fn()} />)
  await user.click(screen.getByRole('switch', { name: T('lock:settings.pinRowLabel') }))
  expect(reset).toHaveBeenCalled()
})

test('shows an actionable error when disabling the lock fails', async () => {
  const failingReset = vi.fn().mockRejectedValue(new Error('IDB blocked'))
  state = { ...baseState, enabled: true, reset: failingReset }
  const user = userEvent.setup()
  render(<LockSettings open onClose={vi.fn()} />)
  await user.click(screen.getByRole('switch', { name: T('lock:settings.pinRowLabel') }))
  expect(await screen.findByRole('alert')).toHaveTextContent(T('lock:errors.disableDefault'))
})

test('the back button closes the panel', async () => {
  state = { ...baseState }
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<LockSettings open onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: T('lock:settings.back') }))
  expect(onClose).toHaveBeenCalled()
})
