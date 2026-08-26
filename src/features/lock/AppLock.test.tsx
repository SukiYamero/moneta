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
import { i18next } from '@/lib/i18n'
import { toast, useToastStore, type ToastMessageKey } from '@/lib/toastStore'

// Resolved lazily, at call time — i18next.language isn't forced to 'es'
// until src/test/setup.ts's `beforeAll` runs, which is after this module's
// own top-level code already evaluated.
const T = (key: ToastMessageKey): string => i18next.t(key)
const TLock = (key: Extract<ToastMessageKey, `lock:${string}`>): string => i18next.t(key)

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

// resume()'s lockout branch sets phase: 'unlocked' and error: LOCKED_OUT_ERROR
// in the same set() — LockScreen unmounts in that same instant, so it can't
// be the one to show this. AppLock stays mounted across the transition.
test('surfaces a lockout/session error above the app once the phase leaves "locked"', () => {
  state = { phase: 'unlocked', error: 'locked out' }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent(TLock('lock:errors.lockedOut'))
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
  act(() => toast.success('toast:demo.saved'))
  expect(screen.getByText(T('toast:demo.saved'))).toBeInTheDocument()
})

test('never renders a toast over LockScreen', () => {
  state = { phase: 'locked', error: null, biometricEnrolled: false, unlockPin: vi.fn() }
  render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.success('toast:demo.saved'))
  expect(screen.queryByText(T('toast:demo.saved'))).not.toBeInTheDocument()
})

test('a toast raised while locked is dropped, not queued for after unlock', () => {
  state = { phase: 'locked', error: null, biometricEnrolled: false, unlockPin: vi.fn() }
  const { rerender } = render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.error('toast:demo.syncFailed'))

  state = { phase: 'unlocked', error: null }
  rerender(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )

  expect(screen.queryByText(T('toast:demo.syncFailed'))).not.toBeInTheDocument()
})

// The boot window: phase starts 'unknown' while lockStore.init() resolves,
// and AppLock renders null for that whole stretch — no content is on
// screen yet, so a toast raised then must be suppressed exactly like one
// raised while locked, not just the two phases named in the spec prose.
test('a toast raised during the "unknown" boot window is dropped, not shown once the phase resolves', () => {
  state = { phase: 'unknown', error: null }
  const { rerender } = render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.error('toast:demo.syncFailed'))

  state = { phase: 'unlocked', error: null }
  rerender(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )

  expect(screen.queryByText(T('toast:demo.syncFailed'))).not.toBeInTheDocument()
})

// Symmetric case: a toast already showing when the phase drops back to
// 'locked' (e.g. the app backgrounds mid-toast) must not survive to
// reappear on the next unlock — suppression clears the live stack, not
// just future arrivals (toastStore.test.ts covers the store-level guarantee
// this integration relies on).
test('a toast visible when the app re-locks does not resurface on the next unlock', () => {
  state = { phase: 'unlocked', error: null }
  const { rerender } = render(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  act(() => toast.success('toast:demo.saved'))
  expect(screen.getByText(T('toast:demo.saved'))).toBeInTheDocument()

  state = { phase: 'locked', error: null, biometricEnrolled: false, unlockPin: vi.fn() }
  rerender(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.queryByText(T('toast:demo.saved'))).not.toBeInTheDocument()

  state = { phase: 'unlocked', error: null }
  rerender(
    <AppLock>
      <div>app</div>
    </AppLock>,
  )
  expect(screen.queryByText(T('toast:demo.saved'))).not.toBeInTheDocument()
})
