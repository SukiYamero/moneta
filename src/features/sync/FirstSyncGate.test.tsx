import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/lib/authStore'
import { useDataStore } from '@/lib/dataStore'

vi.mock('@/lib/repoProvider', () => ({ getActiveProfileBinding: vi.fn() }))
vi.mock('@/lib/sync/syncSession', () => ({ runInitialSync: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/features/sync/DriveDownloadScreen', () => ({
  DriveDownloadScreen: ({ onDone }: { onDone: () => void }) => (
    <button type="button" onClick={onDone}>
      fake-download-done
    </button>
  ),
}))

import { getActiveProfileBinding } from '@/lib/repoProvider'
import { runInitialSync } from '@/lib/sync/syncSession'
import { FirstSyncGate, __resetFirstSyncGateForTests } from '@/features/sync/FirstSyncGate'

const mGetActiveProfileBinding = vi.mocked(getActiveProfileBinding)
const mRunInitialSync = vi.mocked(runInitialSync)

const profile = {
  id: 'p1',
  label: 'Test',
  kind: 'google' as const,
  databaseName: 'kurobello-p1',
  createdAt: '2026-08-01T00:00:00.000Z',
  lastUsedAt: '2026-08-01T00:00:00.000Z',
}

const originalAuthState = useAuthStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState(originalAuthState, true)
  mGetActiveProfileBinding.mockReturnValue(null)
  __resetFirstSyncGateForTests()
})

afterEach(() => {
  useAuthStore.setState(originalAuthState, true)
})

describe('FirstSyncGate', () => {
  it('renders children immediately for a guest — no gate ever shows', () => {
    useAuthStore.setState({ status: 'guest', drive: null })
    render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    expect(screen.getByText('app')).toBeInTheDocument()
    expect(screen.queryByText('fake-download-done')).not.toBeInTheDocument()
  })

  it('renders children immediately for a signed-in user with no Drive connection', () => {
    useAuthStore.setState({ status: 'authenticated', drive: null })
    render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('a returning user (already synced before) never sees the gate — the pull runs behind the rendered UI', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mGetActiveProfileBinding.mockReturnValue({
      profile: { ...profile, lastPullAt: '2026-08-01T00:00:00.000Z' },
      database: {} as never,
      repo: {} as never,
    })
    render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    expect(screen.getByText('app')).toBeInTheDocument()
    expect(mRunInitialSync).toHaveBeenCalledOnce()
  })

  it('a genuinely fresh Drive-linked profile (never pulled) blocks on the download gate instead of showing children', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    expect(screen.queryByText('app')).not.toBeInTheDocument()
    expect(screen.getByText('fake-download-done')).toBeInTheDocument()
    expect(mRunInitialSync).not.toHaveBeenCalled()
  })

  it('once the gated download finishes, resets and reloads dataStore, then reveals children', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    const resetSpy = vi.spyOn(useDataStore.getState(), 'reset')
    const loadSpy = vi.spyOn(useDataStore.getState(), 'load').mockResolvedValue(undefined)

    render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    await user.click(screen.getByText('fake-download-done'))

    expect(resetSpy).toHaveBeenCalledOnce()
    expect(loadSpy).toHaveBeenCalledOnce()
    expect(screen.getByText('app')).toBeInTheDocument()

    resetSpy.mockRestore()
    loadSpy.mockRestore()
  })

  it('a profile dismissed via "continue without Drive" does not re-show the gate on the next remount', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })

    const first = render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    await user.click(first.getByText('fake-download-done'))
    expect(first.getByText('app')).toBeInTheDocument()
    first.unmount()

    const second = render(
      <FirstSyncGate>
        <div>app</div>
      </FirstSyncGate>,
    )
    expect(second.queryByText('fake-download-done')).not.toBeInTheDocument()
    expect(second.getByText('app')).toBeInTheDocument()
  })
})
