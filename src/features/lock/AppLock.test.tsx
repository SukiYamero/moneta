import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const init = vi.fn().mockResolvedValue(undefined)
const onHidden = vi.fn()
const onVisible = vi.fn().mockResolvedValue(undefined)
const clearError = vi.fn()

let state: Record<string, unknown> = {}

vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: Object.assign((selector: (s: unknown) => unknown) => selector(state), {
    getState: () => ({ ...state, init, onHidden, onVisible, clearError }),
  }),
}))

import { AppLock } from '@/features/lock/AppLock'
import { toast, useToastStore } from '@/lib/toastStore'

beforeEach(() => {
  vi.clearAllMocks()
  state = { phase: 'unlocked', error: null }
  useToastStore.setState({ items: [] })
})

test('renders nothing while the lock phase is still unknown', () => {
  state = { phase: 'unknown', error: null }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.queryByText('app')).not.toBeInTheDocument()
})

test('renders the lock screen while locked', () => {
  state = { phase: 'locked', error: null, biometricEnrolled: false, unlockPin: vi.fn() }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.queryByText('app')).not.toBeInTheDocument()
})

test('renders children once unlocked', () => {
  state = { phase: 'unlocked', error: null }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.getByText('app')).toBeInTheDocument()
})

// Finding 4 ("invisible"): resume()'s lockout branch sets phase: 'unlocked'
// and error: LOCKED_OUT_ERROR in the same set() — LockScreen (the only prior
// consumer of lockStore.error) unmounts in that same instant, so the message
// was structurally unreachable. AppLock is one level up and stays mounted
// across the phase transition, so it's the right place to surface it.
test('surfaces a lockout/session error above the app once the phase leaves "locked"', () => {
  state = { phase: 'unlocked', error: 'locked out' }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent(/demasiados intentos/i)
  expect(screen.getByText('app')).toBeInTheDocument()
})

test('does not duplicate the error banner while still locked — LockScreen owns its own', () => {
  state = {
    phase: 'locked',
    error: 'lock: wrong pin',
    biometricEnrolled: false,
    unlockPin: vi.fn(),
  }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  // LockScreen renders its own role="alert" for this message; AppLock must
  // not render a second one on top of it.
  expect(screen.getAllByRole('alert')).toHaveLength(1)
})

test('dismissing the banner clears the error', async () => {
  state = { phase: 'unlocked', error: 'locked out', clearError }
  const user = userEvent.setup()
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  await user.click(screen.getByRole('button', { name: /cerrar|dismiss|×/i }))
  expect(clearError).toHaveBeenCalled()
})

test('renders a toast raised while unlocked', () => {
  state = { phase: 'unlocked', error: null }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.success('Guardado'))
  expect(screen.getByText('Guardado')).toBeInTheDocument()
})

test('never renders a toast over LockScreen', () => {
  state = { phase: 'locked', error: null, biometricEnrolled: false, unlockPin: vi.fn() }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.success('Movimiento guardado en segundo plano'))
  expect(screen.queryByText('Movimiento guardado en segundo plano')).not.toBeInTheDocument()
})

test('a toast raised while locked is dropped, not queued for after unlock', () => {
  state = { phase: 'locked', error: null, biometricEnrolled: false, unlockPin: vi.fn() }
  const { rerender } = render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.error('Falló mientras estaba bloqueado'))

  state = { phase: 'unlocked', error: null }
  rerender(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )

  expect(screen.queryByText('Falló mientras estaba bloqueado')).not.toBeInTheDocument()
})
