import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const unlockPin = vi.fn()
vi.mock('@/lib/lockStore', () => ({
  useLockStore: (selector: (s: unknown) => unknown) =>
    selector({
      phase: 'locked',
      biometricAvailable: false,
      error: null,
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
