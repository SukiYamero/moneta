import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'
import type { ToastMessageKey } from '@/lib/toastStore'

const T = (key: Extract<ToastMessageKey, `lock:${string}`>): string => i18next.t(key)

const enable = vi.fn()
let biometricAvailable = false

vi.mock('@/lib/lockStore', () => ({
  LOCKED_OUT_ERROR: 'locked out',
  NO_SESSION_ERROR: 'lock: no session to protect',
  SESSION_RESTORE_ERROR: 'lock: could not restore the session after unlock',
  useLockStore: (selector: (s: unknown) => unknown) =>
    selector({
      enable,
      get biometricAvailable() {
        return biometricAvailable
      },
    }),
}))

import { PinSetup } from '@/features/lock/PinSetup'

beforeEach(() => {
  vi.clearAllMocks()
  enable.mockResolvedValue(undefined)
  biometricAvailable = false
})

// Both steps label the hidden input with the fixed `screen.pinLabel` ("PIN")
// rather than the dynamic step title — a step title reused as the input's
// accessible name would collide with the visible `<h1>` carrying the exact
// same text, an accessibility duplication bug the design's own two-step
// copy would otherwise hide.
const typePin = async (user: ReturnType<typeof userEvent.setup>, pin: string) => {
  await user.type(screen.getByLabelText(T('lock:screen.pinLabel')), pin)
}

test('shows the "new" kicker and create step first', () => {
  render(<PinSetup open onClose={vi.fn()} mode="new" />)
  expect(screen.getByText(T('lock:setup.kickerNew'))).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: T('lock:setup.titleCreate') })).toBeInTheDocument()
})

test('shows the "change" kicker when changing an existing PIN', () => {
  render(<PinSetup open onClose={vi.fn()} mode="change" />)
  expect(screen.getByText(T('lock:setup.kickerChange'))).toBeInTheDocument()
})

test('entering the same PIN twice calls enable and closes', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<PinSetup open onClose={onClose} mode="new" />)

  await typePin(user, '1234')
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: T('lock:setup.titleConfirm') })).toBeInTheDocument(),
  )
  await typePin(user, '1234')

  await waitFor(() => expect(enable).toHaveBeenCalledWith('1234', false))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('a mismatched confirm PIN shows an error and returns to an empty confirm entry, never calling enable', async () => {
  const user = userEvent.setup()
  render(<PinSetup open onClose={vi.fn()} mode="new" />)

  await typePin(user, '1234')
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: T('lock:setup.titleConfirm') })).toBeInTheDocument(),
  )
  await typePin(user, '0000')

  expect(await screen.findByRole('alert')).toHaveTextContent(T('lock:setup.mismatch'))
  expect(enable).not.toHaveBeenCalled()
})

test('offers a biometric toggle on the confirm step only when the platform supports it', async () => {
  biometricAvailable = true
  const user = userEvent.setup()
  render(<PinSetup open onClose={vi.fn()} mode="new" />)

  expect(
    screen.queryByRole('switch', { name: T('lock:settings.biometricRowLabel') }),
  ).not.toBeInTheDocument()

  await typePin(user, '1234')
  await waitFor(() =>
    expect(
      screen.getByRole('switch', { name: T('lock:settings.biometricRowLabel') }),
    ).toBeInTheDocument(),
  )
})

test('toggling biometric on before confirming passes biometric: true to enable', async () => {
  biometricAvailable = true
  const user = userEvent.setup()
  render(<PinSetup open onClose={vi.fn()} mode="new" />)

  await typePin(user, '1234')
  await user.click(screen.getByRole('switch', { name: T('lock:settings.biometricRowLabel') }))
  await typePin(user, '1234')

  await waitFor(() => expect(enable).toHaveBeenCalledWith('1234', true))
})

test('shows an actionable error when enable() fails, never the raw message', async () => {
  enable.mockRejectedValue(new Error('lock: no session to protect'))
  const user = userEvent.setup()
  render(<PinSetup open onClose={vi.fn()} mode="new" />)

  await typePin(user, '1234')
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: T('lock:setup.titleConfirm') })).toBeInTheDocument(),
  )
  await typePin(user, '1234')

  expect(await screen.findByRole('alert')).toHaveTextContent(T('lock:errors.noSession'))
  expect(screen.queryByText(/no session to protect/i)).not.toBeInTheDocument()
})

// The pad is already disabled during a pending enable() (`disabled={submitting}`
// above); the biometric toggle shares the same dependency in the auto-submit
// effect (`[pin, step, firstPin, biometric]`), so toggling it while a first
// call is in flight re-fires the effect and calls enable() a second time,
// concurrently, with a different biometric value — a real WebAuthn ceremony
// leaves this window open for several seconds, not a contrived race.
test('the biometric toggle is disabled while a submission is in flight, so it cannot double-submit enable()', async () => {
  biometricAvailable = true
  let resolveEnable: () => void = () => {}
  enable.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveEnable = resolve
    }),
  )
  const user = userEvent.setup()
  render(<PinSetup open onClose={vi.fn()} mode="new" />)

  await typePin(user, '1234')
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: T('lock:setup.titleConfirm') })).toBeInTheDocument(),
  )
  await typePin(user, '1234')

  const toggle = await screen.findByRole('switch', { name: T('lock:settings.biometricRowLabel') })
  await waitFor(() => expect(toggle).toBeDisabled())

  await user.click(toggle)
  expect(enable).toHaveBeenCalledTimes(1)

  resolveEnable()
})

test('the X-close button resets and closes the panel', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<PinSetup open onClose={onClose} mode="new" />)
  await user.click(screen.getByRole('button', { name: T('lock:setup.close') }))
  expect(onClose).toHaveBeenCalled()
})

test('renders nothing when closed', () => {
  render(<PinSetup open={false} onClose={vi.fn()} mode="new" />)
  expect(screen.queryByText(T('lock:setup.titleCreate'))).not.toBeInTheDocument()
})

// Same shape as the amount field (specs.md §10.54): the hidden input backs
// `PinPad`, our own on-screen keypad, and is programmatically focused via
// `initialFocus` the moment this panel opens — without inputMode="none" that
// focus raises the OS keyboard on top of the pad it is meant to replace.
test('the hidden PIN input suppresses the native keyboard so only the on-screen pad shows', () => {
  render(<PinSetup open onClose={vi.fn()} mode="new" />)
  expect(screen.getByLabelText(T('lock:screen.pinLabel'))).toHaveAttribute('inputMode', 'none')
})
