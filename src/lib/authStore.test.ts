import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requestAccessToken: vi.fn(),
  fetchGoogleUser: vi.fn(),
  DRIVE_SCOPES: 'drive-scopes',
}))
vi.mock('@/lib/bootstrap', () => ({ bootstrap: vi.fn() }))
vi.mock('@/lib/pinLock', () => ({ hasVault: vi.fn(), updateSession: vi.fn() }))

import { requestAccessToken, fetchGoogleUser } from '@/lib/auth'
import { bootstrap } from '@/lib/bootstrap'
import { hasVault, updateSession } from '@/lib/pinLock'
import { useAuthStore } from '@/lib/authStore'

const mToken = vi.mocked(requestAccessToken)
const mUser = vi.mocked(fetchGoogleUser)
const mBootstrap = vi.mocked(bootstrap)
const mHasVault = vi.mocked(hasVault)
const mUpdateSession = vi.mocked(updateSession)

beforeEach(() => {
  vi.clearAllMocks()
  mHasVault.mockResolvedValue(false)
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
  })
})

describe('useAuthStore.login', () => {
  it('authenticates with identity only and does not touch Drive', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.user).toEqual({ email: 'a@b.com', name: 'Ana' })
    expect(s.session?.accessToken).toBe('tok')
    expect(s.drive).toBeNull()
    expect(s.driveOptIn).toBe('pending')
    expect(mBootstrap).not.toHaveBeenCalled()
    expect(mToken).toHaveBeenCalledWith('consent')
  })

  it('transitions to error and keeps no token when auth fails', async () => {
    mToken.mockRejectedValue(new Error('access: access_denied'))

    await useAuthStore.getState().login()

    const s = useAuthStore.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('access: access_denied')
    expect(s.session).toBeNull()
  })

  it('caches the fresh session in the lock vault when one exists', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockResolvedValue(true)

    await useAuthStore.getState().login()

    expect(mUpdateSession).toHaveBeenCalledWith({ accessToken: 'tok', expiresAt: 1 })
  })

  it('never calls updateSession when no vault exists', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockResolvedValue(false)

    await useAuthStore.getState().login()

    expect(mUpdateSession).not.toHaveBeenCalled()
  })

  it('does not throw or block login when updateSession itself fails', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockResolvedValue(true)
    mUpdateSession.mockRejectedValue(new Error('lock: not unlocked'))

    await expect(useAuthStore.getState().login()).resolves.toBeUndefined()
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('does not throw or block login when hasVault itself fails', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockRejectedValue(new Error('IDB blocked'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(useAuthStore.getState().login()).resolves.toBeUndefined()

    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('useAuthStore.restore', () => {
  it('silently authenticates with prompt "" and falls back to idle on failure', async () => {
    mToken.mockRejectedValue(new Error('access: no session'))
    await useAuthStore.getState().restore()
    expect(mToken).toHaveBeenCalledWith('')
    expect(useAuthStore.getState().status).toBe('idle')
  })

  it('caches the fresh session in the lock vault when one exists', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockResolvedValue(true)

    await useAuthStore.getState().restore()

    expect(mUpdateSession).toHaveBeenCalledWith({ accessToken: 'tok', expiresAt: 1 })
  })

  it('is a no-op when status is not idle, so it can only run once on boot', async () => {
    useAuthStore.setState({ status: 'authenticating' })

    await useAuthStore.getState().restore()

    expect(mToken).not.toHaveBeenCalled()
  })
})

describe('useAuthStore.logout', () => {
  it('clears all session state, including Drive opt-in', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
      drive: { folderId: 'F', movimientosFileId: 'M', activosFileId: 'A', configFileId: 'C' },
      error: null,
      driveOptIn: 'connected',
      driveConnecting: true,
      driveError: 'boom',
    })
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s).toMatchObject({
      status: 'idle',
      user: null,
      session: null,
      drive: null,
      driveOptIn: 'pending',
      driveConnecting: false,
      driveError: null,
    })
  })
})

describe('useAuthStore.connectDrive', () => {
  it('requests Drive scopes incrementally, provisions the layout and upgrades the session', async () => {
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
      movimientosFileId: 'M',
      activosFileId: 'A',
      configFileId: 'C',
    })
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'identity-tok', expiresAt: 1 },
      drive: null,
      error: null,
    })

    await useAuthStore.getState().connectDrive()

    expect(mToken).toHaveBeenCalledWith('', 'drive-scopes')
    expect(mBootstrap).toHaveBeenCalledWith('drive-tok')
    const s = useAuthStore.getState()
    expect(s.drive?.folderId).toBe('F')
    expect(s.session?.accessToken).toBe('drive-tok')
    expect(s.driveOptIn).toBe('connected')
    expect(s.driveConnecting).toBe(false)
    expect(s.driveError).toBeNull()
  })

  it('caches the upgraded session in the lock vault when one exists', async () => {
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
      movimientosFileId: 'M',
      activosFileId: 'A',
      configFileId: 'C',
    })
    mHasVault.mockResolvedValue(true)

    await useAuthStore.getState().connectDrive()

    expect(mUpdateSession).toHaveBeenCalledWith({ accessToken: 'drive-tok', expiresAt: 2 })
  })

  it('surfaces a driveError and stays usable on failure, without touching identity status', async () => {
    mToken.mockRejectedValue(new Error('drive: 403'))
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'identity-tok', expiresAt: 1 },
      drive: null,
      error: null,
    })

    await useAuthStore.getState().connectDrive()

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.session?.accessToken).toBe('identity-tok')
    expect(s.drive).toBeNull()
    expect(s.driveOptIn).toBe('pending')
    expect(s.driveConnecting).toBe(false)
    expect(s.driveError).toBe('drive: 403')
  })

  it('sets driveConnecting while the request is in flight', async () => {
    let resolveToken: (v: { accessToken: string; expiresAt: number }) => void = () => {}
    mToken.mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve
      }),
    )

    const pending = useAuthStore.getState().connectDrive()
    await Promise.resolve()
    expect(useAuthStore.getState().driveConnecting).toBe(true)

    resolveToken({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
      movimientosFileId: 'M',
      activosFileId: 'A',
      configFileId: 'C',
    })
    await pending
    expect(useAuthStore.getState().driveConnecting).toBe(false)
  })

  it('does not resurrect a logged-out session with a stale in-flight resolve', async () => {
    let resolveToken: (v: { accessToken: string; expiresAt: number }) => void = () => {}
    mToken.mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve
      }),
    )
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'identity-tok', expiresAt: 1 },
      drive: null,
    })

    const pending = useAuthStore.getState().connectDrive()
    await Promise.resolve()
    useAuthStore.getState().logout()

    resolveToken({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
      movimientosFileId: 'M',
      activosFileId: 'A',
      configFileId: 'C',
    })
    await pending

    const s = useAuthStore.getState()
    expect(s.status).toBe('idle')
    expect(s.session).toBeNull()
    expect(s.drive).toBeNull()
    expect(s.driveOptIn).toBe('pending')
    expect(mUpdateSession).not.toHaveBeenCalled()
  })
})

describe('useAuthStore.dismissDrive', () => {
  it('marks the opt-in as dismissed for this session', () => {
    useAuthStore.getState().dismissDrive()
    expect(useAuthStore.getState().driveOptIn).toBe('dismissed')
  })
})

describe('useAuthStore.hydrate', () => {
  it('populates user from an existing session without touching Drive', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().hydrate(session)

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.session).toEqual(session)
    expect(s.user).not.toBeNull()
    expect(s.drive).toBeNull()
    expect(mBootstrap).not.toHaveBeenCalled()
  })

  it('transitions to error on failure', async () => {
    const session = { accessToken: 'bad', expiresAt: Date.now() + 3_600_000 }
    mUser.mockRejectedValue(new Error('network error'))

    await useAuthStore.getState().hydrate(session)

    const s = useAuthStore.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('network error')
    expect(s.session).toBeNull()
    expect(s.user).toBeNull()
    expect(s.drive).toBeNull()
  })

  it('does not reset driveOptIn — a re-lock/unlock mid-session must not re-prompt Drive', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    useAuthStore.setState({ driveOptIn: 'connected' })

    await useAuthStore.getState().hydrate(session)

    expect(useAuthStore.getState().driveOptIn).toBe('connected')
  })

  it('caches the fresh session in the lock vault when one exists', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockResolvedValue(true)

    await useAuthStore.getState().hydrate(session)

    expect(mUpdateSession).toHaveBeenCalledWith(session)
  })
})
