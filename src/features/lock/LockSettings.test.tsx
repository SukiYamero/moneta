import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const enable = vi.fn()
const lock = vi.fn()
const reset = vi.fn()

let state: Record<string, unknown> = {}
vi.mock('@/lib/lockStore', () => ({
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
