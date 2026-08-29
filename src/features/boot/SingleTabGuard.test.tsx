import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const init = vi.fn().mockResolvedValue(undefined)
const retry = vi.fn().mockResolvedValue(undefined)

let state: Record<string, unknown> = {}

vi.mock('@/lib/singleTabGuard', () => ({
  useSingleTabGuardStore: Object.assign((selector: (s: unknown) => unknown) => selector(state), {
    getState: () => ({ ...state, init, retry }),
  }),
}))

import { SingleTabGuard } from '@/features/boot/SingleTabGuard'

beforeEach(() => {
  vi.clearAllMocks()
  init.mockResolvedValue(undefined)
  retry.mockResolvedValue(undefined)
  state = { phase: 'checking', init, retry }
})

test('renders nothing while the lock check is in flight', () => {
  state = { phase: 'checking', init, retry }
  render(
    <SingleTabGuard>
      <div>app</div>
    </SingleTabGuard>,
  )
  expect(screen.queryByText('app')).not.toBeInTheDocument()
})

test('renders children once this tab holds the lock', () => {
  state = { phase: 'granted', init, retry }
  render(
    <SingleTabGuard>
      <div>app</div>
    </SingleTabGuard>,
  )
  expect(screen.getByText('app')).toBeInTheDocument()
})

test('renders children unconditionally when navigator.locks is unsupported', () => {
  state = { phase: 'unsupported', init, retry }
  render(
    <SingleTabGuard>
      <div>app</div>
    </SingleTabGuard>,
  )
  expect(screen.getByText('app')).toBeInTheDocument()
})

test('renders the full-screen blocking state instead of mounting the app shell when another tab holds the lock', () => {
  state = { phase: 'blocked', init, retry }
  render(
    <SingleTabGuard>
      <div>app</div>
    </SingleTabGuard>,
  )
  expect(screen.queryByText('app')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toBeInTheDocument()
})

test('calls init() once on mount', () => {
  render(
    <SingleTabGuard>
      <div>app</div>
    </SingleTabGuard>,
  )
  expect(init).toHaveBeenCalledOnce()
})

test('the retry action on the blocking screen calls retry()', async () => {
  state = { phase: 'blocked', init, retry }
  const user = userEvent.setup()
  render(
    <SingleTabGuard>
      <div>app</div>
    </SingleTabGuard>,
  )
  await user.click(screen.getByRole('button'))
  expect(retry).toHaveBeenCalledOnce()
})
