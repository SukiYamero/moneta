import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => {
  class AuthError extends Error {
    constructor(reason: string) {
      super(`auth: ${reason}`)
      this.name = 'AuthError'
    }
  }
  return {
    AuthError,
    requestAccessToken: vi.fn(),
    fetchGoogleUser: vi.fn(),
    DRIVE_SCOPES: 'drive-scopes',
  }
})
vi.mock('@/lib/bootstrap', () => ({ bootstrap: vi.fn() }))
vi.mock('@/lib/boot', () => ({ invalidateBootForSignOut: vi.fn() }))
vi.mock('@/lib/pinLock', () => ({ hasVault: vi.fn(), updateSession: vi.fn(), resetVault: vi.fn() }))
vi.mock('@/lib/profiles', () => ({
  resolveGoogleProfile: vi.fn(),
  setActiveProfileId: vi.fn(),
  getProfile: vi.fn(),
  getProfileDatabase: vi.fn(),
  finishConsentedAdoption: vi.fn(),
  countUnadoptedGuestMovements: vi.fn(),
  DEFAULT_PROFILE_ID: 'kurobello',
}))
vi.mock('@/lib/deviceStore', () => ({
  hasLoggedInBefore: vi.fn(),
  markLoggedIn: vi.fn(),
  getDriveDecision: vi.fn(),
  setDriveDecision: vi.fn(),
  clearDriveDecision: vi.fn(),
  hasUsedGuestBefore: vi.fn(),
  markGuestUsed: vi.fn(),
  clearGuestUsed: vi.fn(),
  hasDeclinedAdoption: vi.fn(),
  markAdoptionDeclined: vi.fn(),
  setAdoptionConsent: vi.fn(),
}))

let networkOnline = true
const mReportOnlineSuccess = vi.fn()
const mReportOnlineFailure = vi.fn()
vi.mock('@/lib/networkStore', () => ({
  useNetworkStore: {
    getState: () => ({
      online: networkOnline,
      reportOnlineSuccess: mReportOnlineSuccess,
      reportOnlineFailure: mReportOnlineFailure,
    }),
  },
}))

import { AuthError, requestAccessToken, fetchGoogleUser } from '@/lib/auth'
import { bootstrap } from '@/lib/bootstrap'
import { invalidateBootForSignOut } from '@/lib/boot'
import { hasVault, resetVault, updateSession } from '@/lib/pinLock'
import {
  countUnadoptedGuestMovements,
  finishConsentedAdoption,
  getProfile,
  getProfileDatabase,
  resolveGoogleProfile,
  setActiveProfileId,
} from '@/lib/profiles'
import {
  clearDriveDecision,
  clearGuestUsed,
  getDriveDecision,
  hasDeclinedAdoption,
  hasLoggedInBefore,
  hasUsedGuestBefore,
  markAdoptionDeclined,
  markGuestUsed,
  markLoggedIn,
  setAdoptionConsent,
  setDriveDecision,
} from '@/lib/deviceStore'
import { useAuthStore } from '@/lib/authStore'

const mToken = vi.mocked(requestAccessToken)
const mUser = vi.mocked(fetchGoogleUser)
const mBootstrap = vi.mocked(bootstrap)
const mHasVault = vi.mocked(hasVault)
const mUpdateSession = vi.mocked(updateSession)
const mResetVault = vi.mocked(resetVault)
const mInvalidateBootForSignOut = vi.mocked(invalidateBootForSignOut)
const mResolveGoogleProfile = vi.mocked(resolveGoogleProfile)
const mSetActiveProfileId = vi.mocked(setActiveProfileId)
const mHasLoggedInBefore = vi.mocked(hasLoggedInBefore)
const mMarkLoggedIn = vi.mocked(markLoggedIn)
const mGetDriveDecision = vi.mocked(getDriveDecision)
const mSetDriveDecision = vi.mocked(setDriveDecision)
const mClearDriveDecision = vi.mocked(clearDriveDecision)
const mHasUsedGuestBefore = vi.mocked(hasUsedGuestBefore)
const mMarkGuestUsed = vi.mocked(markGuestUsed)
const mClearGuestUsed = vi.mocked(clearGuestUsed)
const mGetProfile = vi.mocked(getProfile)
const mGetProfileDatabase = vi.mocked(getProfileDatabase)
const mFinishConsentedAdoption = vi.mocked(finishConsentedAdoption)
const mSetAdoptionConsent = vi.mocked(setAdoptionConsent)
const mCountUnadoptedGuestMovements = vi.mocked(countUnadoptedGuestMovements)
const mHasDeclinedAdoption = vi.mocked(hasDeclinedAdoption)
const mMarkAdoptionDeclined = vi.mocked(markAdoptionDeclined)

beforeEach(() => {
  vi.clearAllMocks()
  networkOnline = true
  mHasVault.mockResolvedValue(false)
  mResetVault.mockResolvedValue(undefined)
  mResolveGoogleProfile.mockResolvedValue({
    id: 'p1',
    label: 'Ana',
    kind: 'google',
    databaseName: 'kurobello-p1',
    accountKey: 'a@b.com',
    createdAt: '2026-08-19T00:00:00.000Z',
    lastUsedAt: '2026-08-19T00:00:00.000Z',
  })
  mHasLoggedInBefore.mockResolvedValue(true)
  mHasUsedGuestBefore.mockResolvedValue(false)
  mGetDriveDecision.mockResolvedValue(undefined)
  mGetProfileDatabase.mockReturnValue({} as never)
  mCountUnadoptedGuestMovements.mockResolvedValue(0)
  mHasDeclinedAdoption.mockResolvedValue(false)
  mGetProfile.mockResolvedValue(undefined)
  mFinishConsentedAdoption.mockResolvedValue({ adoptedCount: 0 })
  mSetAdoptionConsent.mockResolvedValue(undefined)
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
    pendingAdoption: null,
    adoptionBusy: false,
    adoptionError: null,
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

    expect(mUpdateSession).toHaveBeenCalledWith(
      { accessToken: 'tok', expiresAt: 1 },
      { email: 'a@b.com', name: 'Ana' },
    )
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

  it('never logs the access token when the vault sync fails', async () => {
    const secretToken = 'ya29.super-secret-access-token'
    mToken.mockResolvedValue({ accessToken: secretToken, expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mHasVault.mockResolvedValue(true)
    mUpdateSession.mockRejectedValue(new Error('lock: not unlocked'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().login()

    expect(warn).toHaveBeenCalled()
    const loggedText = warn.mock.calls
      .flat()
      .map((arg) => JSON.stringify(arg))
      .join(' ')
    expect(loggedText).not.toContain(secretToken)
    warn.mockRestore()
  })

  it('marks this device as having logged in before, on success', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mMarkLoggedIn).toHaveBeenCalled()
  })

  it('resolves this account in the profile registry, keyed by the stable subject id', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ sub: 'google-sub-1', email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'google-sub-1', label: 'Ana' })
  })

  it('falls back to email as the account key when no subject id is present', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'a@b.com', label: 'Ana' })
  })

  it('resolves the account in the profile registry before status flips to authenticated', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ sub: 'google-sub-1', email: 'a@b.com', name: 'Ana' })
    let resolveProfile!: () => void
    mResolveGoogleProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProfile = () => resolve({ id: 'p1' } as never)
        }),
    )

    const pending = useAuthStore.getState().login()
    await vi.waitFor(() => expect(mResolveGoogleProfile).toHaveBeenCalled())
    expect(useAuthStore.getState().status).toBe('authenticating')

    resolveProfile()
    await pending

    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('does not fail or block login when resolving the profile itself fails', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mResolveGoogleProfile.mockRejectedValue(new Error('IDB blocked'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(useAuthStore.getState().login()).resolves.toBeUndefined()

    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not mark the device when login fails', async () => {
    mToken.mockRejectedValue(new Error('access: access_denied'))

    await useAuthStore.getState().login()

    expect(mMarkLoggedIn).not.toHaveBeenCalled()
  })

  it('clears the guest marker on a successful login', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mClearGuestUsed).toHaveBeenCalled()
  })

  it('does not clear the guest marker when login fails', async () => {
    mToken.mockRejectedValue(new Error('access: access_denied'))

    await useAuthStore.getState().login()

    expect(mClearGuestUsed).not.toHaveBeenCalled()
  })

  it('reports a successful login to the network store', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mReportOnlineSuccess).toHaveBeenCalled()
    expect(mReportOnlineFailure).not.toHaveBeenCalled()
  })

  it('does not report a network failure for a real, non-network auth error', async () => {
    mToken.mockRejectedValue(new AuthError('access_denied'))

    await useAuthStore.getState().login()

    expect(mReportOnlineFailure).not.toHaveBeenCalled()
  })

  it('reports a network failure when GIS itself could not load', async () => {
    mToken.mockRejectedValue(new AuthError('GIS failed to load'))

    await useAuthStore.getState().login()

    expect(mReportOnlineFailure).toHaveBeenCalled()
  })

  it('does not resurrect state when a logout() fires during an in-flight login()', async () => {
    let resolveToken!: (v: { accessToken: string; expiresAt: number }) => void
    mToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve
        }),
    )

    const pending = useAuthStore.getState().login()
    await vi.waitFor(() => expect(mToken).toHaveBeenCalled())

    useAuthStore.getState().logout()
    resolveToken({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    await pending

    const s = useAuthStore.getState()
    expect(s.status).toBe('idle')
    expect(s.session).toBeNull()
  })

  it('does not resurrect state when a logout() fires during the drive-decision lookup after authenticate() resolves', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    let resolveDecision!: (v: 'connected' | 'dismissed' | undefined) => void
    mGetDriveDecision.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDecision = resolve
        }),
    )
    useAuthStore.setState({ driveOptIn: 'pending' })

    const pending = useAuthStore.getState().login()
    await vi.waitFor(() => expect(mGetDriveDecision).toHaveBeenCalled())

    useAuthStore.getState().logout()
    resolveDecision('connected')
    await pending

    const s = useAuthStore.getState()
    expect(s.status).toBe('idle')
    expect(s.session).toBeNull()
    expect(s.driveOptIn).toBe('pending')
  })

  it('resolves a previously persisted "connected" decision and silently re-acquires Drive access', async () => {
    mToken
      .mockResolvedValueOnce({ accessToken: 'identity-tok', expiresAt: 1 })
      .mockResolvedValueOnce({ accessToken: 'drive-tok', expiresAt: 2 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mGetDriveDecision.mockResolvedValue('connected')
    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })

    await useAuthStore.getState().login()
    await vi.waitFor(() => expect(useAuthStore.getState().drive).not.toBeNull())

    const s = useAuthStore.getState()
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive?.folderId).toBe('F')
    expect(s.session?.accessToken).toBe('drive-tok')
    expect(mToken).toHaveBeenNthCalledWith(1, 'consent')
    expect(mToken).toHaveBeenNthCalledWith(2, '', 'drive-scopes')
  })

  it('does not fail login or surface driveError when the silent re-acquire fails', async () => {
    mToken
      .mockResolvedValueOnce({ accessToken: 'identity-tok', expiresAt: 1 })
      .mockRejectedValueOnce(new Error('drive: 403'))
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mGetDriveDecision.mockResolvedValue('connected')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().login()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive).toBeNull()
    expect(s.driveError).toBeNull()
    warn.mockRestore()
  })

  it('resolves a previously persisted "dismissed" decision instead of asking again', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mGetDriveDecision.mockResolvedValue('dismissed')

    await useAuthStore.getState().login()

    expect(useAuthStore.getState().driveOptIn).toBe('dismissed')
  })

  describe('guest-data adoption prompt', () => {
    it('offers adoption when the local profile has movements and the device has never declined', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountUnadoptedGuestMovements.mockResolvedValue(3)

      await useAuthStore.getState().login()

      expect(useAuthStore.getState().pendingAdoption).toEqual({ profileId: 'p1', count: 3 })
    })

    it('never offers adoption when there is nothing local to bring — the common first-sign-in case', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountUnadoptedGuestMovements.mockResolvedValue(0)

      await useAuthStore.getState().login()

      expect(useAuthStore.getState().pendingAdoption).toBeNull()
    })

    it('never re-offers adoption once this device has already declined', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountUnadoptedGuestMovements.mockResolvedValue(5)
      mHasDeclinedAdoption.mockResolvedValue(true)

      await useAuthStore.getState().login()

      expect(useAuthStore.getState().pendingAdoption).toBeNull()
    })

    it('does not fail or block login when the adoption check itself fails', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountUnadoptedGuestMovements.mockRejectedValue(new Error('IDB blocked'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(useAuthStore.getState().login()).resolves.toBeUndefined()

      expect(useAuthStore.getState().status).toBe('authenticated')
      expect(useAuthStore.getState().pendingAdoption).toBeNull()
      warn.mockRestore()
    })

    it('reads local guest data directly, not the guest-used device marker clearGuestUsed() is about to clear', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountUnadoptedGuestMovements.mockResolvedValue(1)

      await useAuthStore.getState().login()

      expect(mClearGuestUsed).toHaveBeenCalled()
      expect(useAuthStore.getState().pendingAdoption).toEqual({ profileId: 'p1', count: 1 })
    })
  })
})

describe('useAuthStore.acceptGuestAdoption / declineGuestAdoption', () => {
  beforeEach(() => {
    useAuthStore.setState({ pendingAdoption: { profileId: 'p1', count: 3 } })
  })

  it('does nothing when there is no pending offer', async () => {
    useAuthStore.setState({ pendingAdoption: null })
    await useAuthStore.getState().acceptGuestAdoption()
    expect(mSetAdoptionConsent).not.toHaveBeenCalled()
    expect(mFinishConsentedAdoption).not.toHaveBeenCalled()
  })

  it('adopts the movements and clears the pending offer on success', async () => {
    mGetProfile.mockResolvedValue({
      id: 'p1',
      label: 'Ana',
      kind: 'google',
      databaseName: 'kurobello-p1',
      accountKey: 'a@b.com',
      createdAt: 'T',
      lastUsedAt: 'T',
    })
    mFinishConsentedAdoption.mockResolvedValue({ adoptedCount: 3 })

    await useAuthStore.getState().acceptGuestAdoption()

    expect(mFinishConsentedAdoption).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    const s = useAuthStore.getState()
    expect(s.pendingAdoption).toBeNull()
    expect(s.adoptionBusy).toBe(false)
    expect(s.adoptionError).toBeNull()
  })

  it('persists the consent for the target profile before attempting the copy', async () => {
    mGetProfile.mockResolvedValue({
      id: 'p1',
      label: 'Ana',
      kind: 'google',
      databaseName: 'kurobello-p1',
      accountKey: 'a@b.com',
      createdAt: 'T',
      lastUsedAt: 'T',
    })

    await useAuthStore.getState().acceptGuestAdoption()

    expect(mSetAdoptionConsent).toHaveBeenCalledWith({ profileId: 'p1', accountKey: 'a@b.com' })
    expect(mSetAdoptionConsent.mock.invocationCallOrder[0]!).toBeLessThan(
      mFinishConsentedAdoption.mock.invocationCallOrder[0]!,
    )
  })

  it('surfaces a failure through adoptionError, isolated from status/error, and keeps the offer for a retry', async () => {
    mGetProfile.mockResolvedValue({
      id: 'p1',
      label: 'Ana',
      kind: 'google',
      databaseName: 'kurobello-p1',
      createdAt: 'T',
      lastUsedAt: 'T',
    })
    mFinishConsentedAdoption.mockRejectedValue(new Error('tab closed'))

    await useAuthStore.getState().acceptGuestAdoption()

    const s = useAuthStore.getState()
    expect(s.adoptionError).toBe('tab closed')
    expect(s.pendingAdoption).toEqual({ profileId: 'p1', count: 3 })
    expect(s.status).not.toBe('error')
    expect(mSetAdoptionConsent).toHaveBeenCalledWith({ profileId: 'p1', accountKey: undefined })
  })

  it('declineGuestAdoption clears the offer and persists the decision, touching nothing local', () => {
    useAuthStore.getState().declineGuestAdoption()

    const s = useAuthStore.getState()
    expect(s.pendingAdoption).toBeNull()
    expect(mSetAdoptionConsent).not.toHaveBeenCalled()
    expect(mFinishConsentedAdoption).not.toHaveBeenCalled()
    expect(mMarkAdoptionDeclined).toHaveBeenCalled()
  })
})

describe('useAuthStore.restore', () => {
  it('is a no-op when status is not idle, so it can only run once on boot', async () => {
    useAuthStore.setState({ status: 'authenticating' })

    await useAuthStore.getState().restore()

    expect(mToken).not.toHaveBeenCalled()
  })

  it('falls back to idle when neither marker is set (a genuine first visit)', async () => {
    mHasLoggedInBefore.mockResolvedValue(false)
    mHasUsedGuestBefore.mockResolvedValue(false)

    await useAuthStore.getState().restore()

    expect(useAuthStore.getState().status).toBe('idle')
    expect(mToken).not.toHaveBeenCalled()
  })

  describe('the guest marker', () => {
    it('enters guest status when no account marker exists but the guest marker does', async () => {
      mHasLoggedInBefore.mockResolvedValue(false)
      mHasUsedGuestBefore.mockResolvedValue(true)

      await useAuthStore.getState().restore()

      const s = useAuthStore.getState()
      expect(s.status).toBe('guest')
      expect(s.user).toBeNull()
      expect(s.session).toBeNull()
      expect(mToken).not.toHaveBeenCalled()
    })

    it('never attempts a silent login when both markers are set — the account marker wins, never guest status', async () => {
      mHasLoggedInBefore.mockResolvedValue(true)
      mHasUsedGuestBefore.mockResolvedValue(true)

      await useAuthStore.getState().restore()

      expect(mToken).not.toHaveBeenCalled()
      expect(useAuthStore.getState().status).toBe('idle')
    })
  })

  it('never attempts a silent Google login when online, even for a device that logged in before — it lands on idle for an explicit tap on ReturningUserScreen instead', async () => {
    mHasLoggedInBefore.mockResolvedValue(true)

    await useAuthStore.getState().restore()

    expect(mToken).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('idle')
  })

  describe('offline', () => {
    it('skips the network call entirely and authenticates from the login marker alone', async () => {
      networkOnline = false

      await useAuthStore.getState().restore()

      expect(mToken).not.toHaveBeenCalled()
      const s = useAuthStore.getState()
      expect(s.status).toBe('authenticated')
      expect(s.session).toBeNull()
      expect(s.user).toBeNull()
      expect(s.error).toBeNull()
    })

    it('still resolves a previously persisted Drive decision without any network call', async () => {
      networkOnline = false
      mGetDriveDecision.mockResolvedValue('dismissed')

      await useAuthStore.getState().restore()

      expect(useAuthStore.getState().driveOptIn).toBe('dismissed')
      expect(mToken).not.toHaveBeenCalled()
    })

    it('does not offline-authenticate a device that has never logged in before', async () => {
      networkOnline = false
      mHasLoggedInBefore.mockResolvedValue(false)

      await useAuthStore.getState().restore()

      expect(useAuthStore.getState().status).toBe('idle')
    })
  })
})

describe('useAuthStore.logout', () => {
  it('clears all session state, including Drive opt-in', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
      drive: { folderId: 'F' },
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

  it('clears the persisted Drive decision so a different account on this device is asked again', () => {
    useAuthStore.setState({ driveOptIn: 'connected' })

    useAuthStore.getState().logout()

    expect(mClearDriveDecision).toHaveBeenCalledOnce()
  })

  it('invalidates the boot store so the next sign-in cannot reuse a stale "ready" from this session', () => {
    useAuthStore.getState().logout()

    expect(mInvalidateBootForSignOut).toHaveBeenCalledOnce()
  })

  it('invalidates the PIN-lock vault so a correct PIN cannot resurrect this account', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
    })

    useAuthStore.getState().logout()

    expect(mResetVault).toHaveBeenCalledOnce()
  })

  it('still completes sign-out even when vault invalidation itself fails', async () => {
    mResetVault.mockRejectedValueOnce(new Error('IDB blocked'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
    })

    useAuthStore.getState().logout()

    expect(useAuthStore.getState().status).toBe('idle')
    expect(useAuthStore.getState().session).toBeNull()
    await Promise.resolve()
    await Promise.resolve()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('useAuthStore.connectDrive', () => {
  it('requests Drive scopes incrementally, provisions the layout and upgrades the session', async () => {
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
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

  it('persists the decision only once the connection actually succeeded', async () => {
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'identity-tok', expiresAt: 1 },
      drive: null,
      error: null,
    })

    await useAuthStore.getState().connectDrive()

    expect(mSetDriveDecision).toHaveBeenCalledWith('connected')
  })

  it('does not persist a decision when bootstrap fails after a successful popup', async () => {
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockRejectedValue(new Error('drive: bootstrap failed'))
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'identity-tok', expiresAt: 1 },
      drive: null,
      error: null,
    })

    await useAuthStore.getState().connectDrive()

    expect(mSetDriveDecision).not.toHaveBeenCalled()
    expect(useAuthStore.getState().driveOptIn).toBe('pending')
  })

  it('caches the upgraded session in the lock vault when one exists', async () => {
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })
    mHasVault.mockResolvedValue(true)

    await useAuthStore.getState().connectDrive()

    expect(mUpdateSession).toHaveBeenCalledWith({ accessToken: 'drive-tok', expiresAt: 2 }, null)
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

  it('persists the dismissal so this device is not asked again', () => {
    useAuthStore.getState().dismissDrive()
    expect(mSetDriveDecision).toHaveBeenCalledWith('dismissed')
  })
})

describe('useAuthStore.hydrate', () => {
  const cachedUser = { email: 'a@b.com', name: 'Ana' }

  it('authenticates synchronously from the cached session and profile, without touching Drive or the network', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, cachedUser)

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.session).toEqual(session)
    expect(s.user).toEqual(cachedUser)
    expect(s.drive).toBeNull()
    expect(mBootstrap).not.toHaveBeenCalled()
  })

  it('resolves the cached profile in the registry, keyed by email', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'a@b.com', label: 'Ana' })
  })

  it('does not resolve a profile when there is no cached user to key it on', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, null)

    expect(mResolveGoogleProfile).not.toHaveBeenCalled()
  })

  it('stays authenticated on the cached profile when the network refresh fails (offline)', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockRejectedValue(new AuthError('GIS failed to load'))

    await useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(mReportOnlineFailure).toHaveBeenCalled())

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.session).toEqual(session)
    expect(s.user).toEqual(cachedUser)
    expect(s.error).toBeNull()
  })

  it('reports a network-shaped refresh failure to the network store, silently', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockRejectedValue(new AuthError('GIS failed to load'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(mReportOnlineFailure).toHaveBeenCalled())

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('logs (but does not silently drop) a non-network-shaped refresh failure', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockRejectedValue(new AuthError('userinfo 401'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())

    expect(mReportOnlineFailure).not.toHaveBeenCalled()
    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.user).toEqual(cachedUser)
    warn.mockRestore()
  })

  it('refreshes user and re-caches the session once fetchGoogleUser succeeds', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    const freshUser = { email: 'a@b.com', name: 'Ana Fresh' }
    mUser.mockResolvedValue(freshUser)
    mHasVault.mockResolvedValue(true)

    await useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(useAuthStore.getState().user).toEqual(freshUser))

    expect(mReportOnlineSuccess).toHaveBeenCalled()
    expect(mUpdateSession).toHaveBeenLastCalledWith(session, freshUser)
  })

  it('does not reset driveOptIn — a re-lock/unlock mid-session must not re-prompt Drive', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    useAuthStore.setState({
      driveOptIn: 'connected',
      drive: { folderId: 'F' },
    })

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(useAuthStore.getState().driveOptIn).toBe('connected')
    expect(mGetDriveDecision).not.toHaveBeenCalled()
    expect(mToken).not.toHaveBeenCalled()
    expect(mBootstrap).not.toHaveBeenCalled()
  })

  it('resolves a previously persisted "dismissed" decision on a PIN-lock cold start', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('dismissed')
    useAuthStore.setState({ driveOptIn: 'pending' })

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(useAuthStore.getState().driveOptIn).toBe('dismissed')
  })

  it('resolves a previously persisted "connected" decision and silently re-acquires Drive access', async () => {
    const session = { accessToken: 'identity-tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('connected')
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })
    useAuthStore.setState({ driveOptIn: 'pending' })

    await useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(useAuthStore.getState().drive).not.toBeNull())

    const s = useAuthStore.getState()
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive?.folderId).toBe('F')
    expect(s.session?.accessToken).toBe('drive-tok')
    expect(mToken).toHaveBeenCalledWith('', 'drive-scopes')
  })

  it('does not fail hydrate or surface driveError when the silent re-acquire fails', async () => {
    const session = { accessToken: 'identity-tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('connected')
    mToken.mockRejectedValue(new Error('drive: 403'))
    useAuthStore.setState({ driveOptIn: 'pending' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive).toBeNull()
    expect(s.driveError).toBeNull()
    warn.mockRestore()
  })

  it('settles without waiting on the silent re-acquire, even if it never resolves', async () => {
    const session = { accessToken: 'identity-tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('connected')
    mToken.mockImplementation(() => new Promise(() => {}))
    useAuthStore.setState({ driveOptIn: 'pending' })

    await expect(useAuthStore.getState().hydrate(session, cachedUser)).resolves.toBeUndefined()

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive).toBeNull()
  })

  it('caches the session and cached profile in the lock vault synchronously, when a vault exists', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mHasVault.mockResolvedValue(true)
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(mUpdateSession).toHaveBeenCalledWith(session, cachedUser)
  })

  it('a logout() during an in-flight silent re-acquire does not resurrect session/drive', async () => {
    const session = { accessToken: 'identity-tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('connected')
    useAuthStore.setState({ driveOptIn: 'pending' })

    let resolveToken!: (v: { accessToken: string; expiresAt: number }) => void
    mToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve
        }),
    )

    const hydratePromise = useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(mToken).toHaveBeenCalled())

    useAuthStore.getState().logout()
    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().drive).toBeNull()

    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })
    resolveToken({ accessToken: 'drive-tok', expiresAt: 2 })
    await hydratePromise

    const s = useAuthStore.getState()
    expect(s.session).toBeNull()
    expect(s.drive).toBeNull()
  })

  it('a logout() during an in-flight profile refresh does not resurrect user', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    let resolveUser!: (v: { email: string; name: string }) => void
    mUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUser = resolve
        }),
    )

    const hydratePromise = useAuthStore.getState().hydrate(session, cachedUser)
    await vi.waitFor(() => expect(mUser).toHaveBeenCalled())

    useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()

    resolveUser({ email: 'a@b.com', name: 'Ana Fresh' })
    await hydratePromise

    expect(useAuthStore.getState().user).toBeNull()
  })
})

describe('useAuthStore.continueAsGuest', () => {
  it('enters a distinct guest status with no user, session, or drive', async () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })

    await useAuthStore.getState().continueAsGuest()

    const s = useAuthStore.getState()
    expect(s.status).toBe('guest')
    expect(s.status).not.toBe('authenticated')
    expect(s.user).toBeNull()
    expect(s.session).toBeNull()
    expect(s.drive).toBeNull()
    expect(s.error).toBeNull()
  })

  it('resets driveOptIn away from a stale connected/dismissed value from a prior session', async () => {
    useAuthStore.setState({ driveOptIn: 'connected' })

    await useAuthStore.getState().continueAsGuest()

    expect(useAuthStore.getState().driveOptIn).toBe('pending')
  })

  it('sets the active-profile pointer to the default local profile so a stale Google profile cannot win', async () => {
    await useAuthStore.getState().continueAsGuest()

    expect(mSetActiveProfileId).toHaveBeenCalledWith('kurobello')
  })

  it('marks this device as having used guest mode', async () => {
    await useAuthStore.getState().continueAsGuest()

    expect(mMarkGuestUsed).toHaveBeenCalled()
  })

  it('awaits the pointer write before flipping status, so a reader of status cannot observe "guest" before the registry reflects it', async () => {
    let resolveWrite: () => void = () => {}
    mSetActiveProfileId.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWrite = resolve
      }),
    )

    const pending = useAuthStore.getState().continueAsGuest()
    expect(useAuthStore.getState().status).not.toBe('guest')

    resolveWrite()
    await pending

    expect(useAuthStore.getState().status).toBe('guest')
  })
})
