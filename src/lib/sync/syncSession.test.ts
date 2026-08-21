import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, requestAccessToken: vi.fn() }
})
vi.mock('@/lib/repoProvider', () => ({ getActiveProfileBinding: vi.fn() }))
vi.mock('@/lib/sync/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sync/engine')>()
  return {
    ...actual,
    startSyncTriggers: vi.fn(actual.startSyncTriggers),
    pull: vi.fn(),
    push: vi.fn(),
  }
})
vi.mock('@/lib/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { requestAccessToken } from '@/lib/auth'
import { useAuthStore } from '@/lib/authStore'
import { useOutboxStore } from '@/lib/outbox'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { pull, push, startSyncTriggers, useSyncStore } from '@/lib/sync/engine'
import { toast } from '@/lib/toastStore'
import type { ProfileRecord } from '@/lib/profiles'
import {
  __resetSyncSessionForTests,
  getSyncContext,
  runInitialSync,
  startSyncSession,
  stopSyncSession,
} from '@/lib/sync/syncSession'

const mRequestAccessToken = vi.mocked(requestAccessToken)
const mGetActiveProfileBinding = vi.mocked(getActiveProfileBinding)
const mStartSyncTriggers = vi.mocked(startSyncTriggers)
const mToastSuccess = vi.mocked(toast.success)
const mPull = vi.mocked(pull)
const mPush = vi.mocked(push)

const profile: ProfileRecord = {
  id: 'p1',
  label: 'Test',
  kind: 'google',
  databaseName: 'kurobello-p1',
  createdAt: '2026-08-01T00:00:00.000Z',
  lastUsedAt: '2026-08-01T00:00:00.000Z',
}

const FRESH_SESSION = { accessToken: 'fresh-tok', expiresAt: Date.now() + 3_600_000 }
const originalAuthState = useAuthStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState(originalAuthState, true)
  mGetActiveProfileBinding.mockReturnValue(null)
})

afterEach(() => {
  __resetSyncSessionForTests()
  useAuthStore.setState(originalAuthState, true)
})

describe('getSyncContext', () => {
  it('is null for a guest — no Drive, so no context ever hands the triggers a token', async () => {
    useAuthStore.setState({ status: 'guest', drive: null, session: null })
    await expect(getSyncContext()).resolves.toBeNull()
  })

  it('is null when authenticated but Drive was never connected', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: null, session: null })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    await expect(getSyncContext()).resolves.toBeNull()
  })

  it('is null before the boot sequence has bound an active profile', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    mGetActiveProfileBinding.mockReturnValue(null)
    await expect(getSyncContext()).resolves.toBeNull()
  })

  it('returns the live token/profile/locale when eligible and the token is fresh', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })

    const ctx = await getSyncContext()

    expect(ctx?.token).toBe('fresh-tok')
    expect(ctx?.profile).toBe(profile)
    expect(mRequestAccessToken).not.toHaveBeenCalled() // fresh — no reason to refresh
  })

  it('reacquires a token near/past expiry and updates authStore so other readers see the fresh one too', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: { accessToken: 'stale-tok', expiresAt: Date.now() - 1_000 },
    })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    mRequestAccessToken.mockResolvedValue({
      accessToken: 'refreshed-tok',
      expiresAt: Date.now() + 3_600_000,
    })

    const ctx = await getSyncContext()

    expect(ctx?.token).toBe('refreshed-tok')
    expect(useAuthStore.getState().session?.accessToken).toBe('refreshed-tok')
  })

  it('degrades to null, not a thrown/user-facing failure, when the silent refresh itself fails', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: { accessToken: 'stale-tok', expiresAt: Date.now() - 1_000 },
    })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    mRequestAccessToken.mockRejectedValue(new Error('popup blocked'))

    await expect(getSyncContext()).resolves.toBeNull()
  })

  // specs.md §10.31 §4: the switcher can bind a profile that belongs to a
  // *different* account than the one currently authenticated ("switching to
  // a Google profile you are not currently signed into shows its local data
  // with sync off") — before the switcher existed this could never happen,
  // so `status`/`drive` alone used to be sufficient.
  it('is null when the bound profile belongs to an account other than the one currently authenticated', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
      user: { sub: 'sub-currently-signed-in', email: 'signed-in@example.com', name: 'Signed In' },
    })
    mGetActiveProfileBinding.mockReturnValue({
      profile: { ...profile, accountKey: 'sub-a-different-account' },
      database: {} as never,
      repo: {} as never,
    })

    await expect(getSyncContext()).resolves.toBeNull()
  })

  it('returns a context when the bound profile does belong to the currently authenticated account', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
      user: { sub: 'sub-1', email: 'a@b.com', name: 'Ana' },
    })
    mGetActiveProfileBinding.mockReturnValue({
      profile: { ...profile, accountKey: 'sub-1' },
      database: {} as never,
      repo: {} as never,
    })

    const ctx = await getSyncContext()
    expect(ctx?.profile.accountKey).toBe('sub-1')
  })
})

describe('startSyncSession / stopSyncSession', () => {
  it('starts the engine triggers exactly once even if called twice while already running', () => {
    startSyncSession()
    startSyncSession()
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(1)
  })

  it('stop() then start() again is a genuinely fresh start, not a no-op', () => {
    startSyncSession()
    stopSyncSession()
    startSyncSession()
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(2)
  })

  it('stop() when nothing was started is a harmless no-op', () => {
    expect(() => stopSyncSession()).not.toThrow()
  })
})

describe('the authStore subscription that drives start/stop', () => {
  it('starts the moment authStore reaches a live Drive-scoped session, with no explicit call needed', () => {
    expect(mStartSyncTriggers).not.toHaveBeenCalled()
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(1)
  })

  it('never starts for a guest — status alone flipping to guest is not an eligible transition', () => {
    useAuthStore.setState({ status: 'guest', drive: null, session: null })
    expect(mStartSyncTriggers).not.toHaveBeenCalled()
  })

  it('stops on sign-out (drive/session cleared, status back to idle)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(1)

    useAuthStore.setState({ status: 'idle', drive: null, session: null })
    // startSyncSession() was never called a 2nd time — only stop() ran.
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(1)

    // And it starts fresh again on a subsequent sign-in — proving the
    // handle was actually torn down, not left dangling.
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(2)
  })

  it('does not re-start on every unrelated authStore update once already eligible (idempotent, not re-triggered per field change)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(1)

    useAuthStore.setState({ driveConnecting: true }) // unrelated field
    useAuthStore.setState({ driveConnecting: false })
    expect(mStartSyncTriggers).toHaveBeenCalledTimes(1)
  })
})

describe('the revived-movement notice (specs.md §10.19/§10.26 §4)', () => {
  afterEach(() => {
    useSyncStore.setState({ lastPullSummary: null })
  })

  it('raises the toast once, with the right count, when a pull revives movements', () => {
    useSyncStore.setState({
      lastPullSummary: { filesReconciled: 1, revivedMovIds: ['m1', 'm2'], skippedEntries: 0 },
    })
    expect(mToastSuccess).toHaveBeenCalledWith('sync:notices.revived_other', { count: 2 })
  })

  it('uses the singular key for exactly one revived movement', () => {
    useSyncStore.setState({
      lastPullSummary: { filesReconciled: 1, revivedMovIds: ['m1'], skippedEntries: 0 },
    })
    expect(mToastSuccess).toHaveBeenCalledWith('sync:notices.revived_one', { count: 1 })
  })

  it('stays silent for an ordinary pull with nothing revived', () => {
    useSyncStore.setState({
      lastPullSummary: { filesReconciled: 1, revivedMovIds: [], skippedEntries: 0 },
    })
    expect(mToastSuccess).not.toHaveBeenCalled()
  })

  it('does not re-raise for the same summary object set twice (reference-equal — no duplicate work)', () => {
    const summary = { filesReconciled: 1, revivedMovIds: ['m1'], skippedEntries: 0 }
    useSyncStore.setState({ lastPullSummary: summary })
    expect(mToastSuccess).toHaveBeenCalledTimes(1)
    useSyncStore.setState({ lastPullSummary: summary })
    expect(mToastSuccess).toHaveBeenCalledTimes(1)
  })
})

describe('runInitialSync', () => {
  afterEach(() => {
    useOutboxStore.setState({ dirty: false })
  })

  it('is a no-op when there is no eligible sync context (guest, no Drive, no bound profile)', async () => {
    useAuthStore.setState({ status: 'guest', drive: null, session: null })
    await runInitialSync()
    expect(mPull).not.toHaveBeenCalled()
    expect(mPush).not.toHaveBeenCalled()
  })

  it('pulls, and pushes too only if the outbox is already dirty — "pull on app open" (specs.md §10.19)', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    mPull.mockResolvedValue({ filesReconciled: 0, revivedMovIds: [], skippedEntries: 0 })

    await runInitialSync()
    expect(mPull).toHaveBeenCalledWith('fresh-tok', profile, 'es')
    expect(mPush).not.toHaveBeenCalled() // nothing pending — a reconnect must stay free of a no-op push

    useOutboxStore.setState({ dirty: true })
    mPush.mockResolvedValue(undefined)
    await runInitialSync()
    expect(mPush).toHaveBeenCalledWith('fresh-tok', profile)
  })

  it('never throws past itself when the pull fails — the next trigger retries, this is not a user-facing failure', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      session: FRESH_SESSION,
    })
    mGetActiveProfileBinding.mockReturnValue({ profile, database: {} as never, repo: {} as never })
    mPull.mockRejectedValue(new Error('network blip'))

    await expect(runInitialSync()).resolves.toBeUndefined()
  })
})
