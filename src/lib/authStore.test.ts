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
  finishConsentedAdoption: vi.fn(),
  countGuestMovements: vi.fn(),
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
  countGuestMovements,
  finishConsentedAdoption,
  getProfile,
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
const mFinishConsentedAdoption = vi.mocked(finishConsentedAdoption)
const mSetAdoptionConsent = vi.mocked(setAdoptionConsent)
const mCountGuestMovements = vi.mocked(countGuestMovements)
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
  // Most tests exercise something other than the login-marker gate itself —
  // default it to "already seen a login on this device" so restore()'s
  // other behaviors (silent-auth success/failure) stay reachable; the
  // marker-gating tests below override this explicitly.
  mHasLoggedInBefore.mockResolvedValue(true)
  // Default: this device has never used guest mode — the restore() guest-
  // branch tests below override this explicitly.
  mHasUsedGuestBefore.mockResolvedValue(false)
  // Default: no persisted Drive decision on this device — most tests exercise
  // something other than the persistence itself, so they see the pre-existing
  // 'pending' behavior unless they override this explicitly.
  mGetDriveDecision.mockResolvedValue(undefined)
  // Default: no local guest data and no prior decline — most login() tests
  // exercise something other than adoption, so `pendingAdoption` stays null
  // unless a test overrides this explicitly.
  mCountGuestMovements.mockResolvedValue(0)
  mHasDeclinedAdoption.mockResolvedValue(false)
  mGetProfile.mockResolvedValue(undefined)
  mFinishConsentedAdoption.mockResolvedValue({ movedCount: 0 })
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

  // The access token must never reach a log — syncLockedSession's catch
  // logs only the caught error, never the session it was given.
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

  // An explicit, successful login() is the only thing that should ever let
  // a later cold start attempt a silent restore.
  it('marks this device as having logged in before, on success', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mMarkLoggedIn).toHaveBeenCalled()
  })

  // Keyed by the OIDC `sub` claim, not the Workspace-mutable `email` — a
  // renamed primary address would otherwise resolve to a brand-new profile
  // with none of its data.
  it('resolves this account in the profile registry, keyed by the stable subject id', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ sub: 'google-sub-1', email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'google-sub-1', label: 'Ana' })
  })

  // Defensive fallback only — real `fetchGoogleUser` responses always carry
  // `sub`, but a cached/legacy `GoogleUser` without one must still resolve
  // to *some* profile rather than throwing.
  it('falls back to email as the account key when no subject id is present', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().login()

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'a@b.com', label: 'Ana' })
  })

  // A boot sequence reading the active-profile registry the instant `status`
  // flips to 'authenticated' must never race `resolveGoogleProfile`'s own
  // write to that registry — the profile must land in the registry before
  // `status` commits, not concurrently with it.
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

  // A stale guest marker surviving login would send a signed-in user back
  // into guest mode on the next cold start. Not conditioned on having
  // actually been a guest this session: clearing an absent marker is a
  // no-op, so always clearing is simpler and just as correct.
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

  // access_denied/popup_closed are real, non-network outcomes — the user
  // declined or dismissed the Google popup while genuinely online, so this
  // must not downgrade the network hint.
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

  // A logout() firing while a login() is still in flight must not have the
  // late resolve land status/session for an account already signed out of —
  // same guard shape as connectDrive's own.
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

  // The same guard must hold across *every* await before the state-
  // committing set(), not just the first: resolveDriveOptIn()'s own storage
  // read is a second await, and a logout() landing there must be caught too.
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

  // A device that already answered must not be asked again, even on a fresh
  // explicit login() — e.g. after restore() fell back to idle without a
  // logout() in between.
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
    // The re-acquire is fire-and-forget (never awaited by login() itself —
    // it must not delay the auth flow it rides on), so its own completion
    // has to be waited for separately here.
    await vi.waitFor(() => expect(useAuthStore.getState().drive).not.toBeNull())

    const s = useAuthStore.getState()
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive?.folderId).toBe('F')
    // The identity-only token from authenticate() never reaches the vault —
    // it's upgraded to the Drive-scoped one before syncLockedSession runs.
    expect(s.session?.accessToken).toBe('drive-tok')
    expect(mToken).toHaveBeenNthCalledWith(1, 'consent')
    expect(mToken).toHaveBeenNthCalledWith(2, '', 'drive-scopes')
  })

  // Without this, a device that persisted 'connected' yesterday would land
  // authenticated today holding an identity-only token and drive === null,
  // with no UI left to fix it since DrivePermissionScreen never reappears.
  it('does not fail login or surface driveError when the silent re-acquire fails', async () => {
    mToken
      .mockResolvedValueOnce({ accessToken: 'identity-tok', expiresAt: 1 })
      .mockRejectedValueOnce(new Error('drive: 403'))
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mGetDriveDecision.mockResolvedValue('connected')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().login()
    // Same reason as above: the reacquire's own failure (and its console.warn)
    // happens after login()'s promise has already settled.
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
      mCountGuestMovements.mockResolvedValue(3)

      await useAuthStore.getState().login()

      expect(useAuthStore.getState().pendingAdoption).toEqual({ profileId: 'p1', count: 3 })
    })

    it('never offers adoption when there is nothing local to bring — the common first-sign-in case', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountGuestMovements.mockResolvedValue(0)

      await useAuthStore.getState().login()

      expect(useAuthStore.getState().pendingAdoption).toBeNull()
    })

    it('never re-offers adoption once this device has already declined', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountGuestMovements.mockResolvedValue(5)
      mHasDeclinedAdoption.mockResolvedValue(true)

      await useAuthStore.getState().login()

      expect(useAuthStore.getState().pendingAdoption).toBeNull()
    })

    it('does not fail or block login when the adoption check itself fails', async () => {
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountGuestMovements.mockRejectedValue(new Error('IDB blocked'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(useAuthStore.getState().login()).resolves.toBeUndefined()

      expect(useAuthStore.getState().status).toBe('authenticated')
      expect(useAuthStore.getState().pendingAdoption).toBeNull()
      warn.mockRestore()
    })

    it('reads local guest data directly, not the guest-used device marker clearGuestUsed() is about to clear', async () => {
      // The adoption check and clearGuestUsed() both fire inside the same
      // login(), and neither may depend on the other's signal.
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ sub: 'sub-1', email: 'a@b.com', name: 'Ana' })
      mCountGuestMovements.mockResolvedValue(1)

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

  it('moves the movements and clears the pending offer on success', async () => {
    mGetProfile.mockResolvedValue({
      id: 'p1',
      label: 'Ana',
      kind: 'google',
      databaseName: 'kurobello-p1',
      accountKey: 'a@b.com',
      createdAt: 'T',
      lastUsedAt: 'T',
    })
    mFinishConsentedAdoption.mockResolvedValue({ movedCount: 3 })

    await useAuthStore.getState().acceptGuestAdoption()

    expect(mFinishConsentedAdoption).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    const s = useAuthStore.getState()
    expect(s.pendingAdoption).toBeNull()
    expect(s.adoptionBusy).toBe(false)
    expect(s.adoptionError).toBeNull()
  })

  // The "yes" tap is what makes an interrupted move resumable across a
  // reload, so it must be persisted durably (deviceStore.ts, not just
  // zustand) and *before* the move starts, or an interruption in that gap
  // would have nothing to resume from.
  it('persists the consent for the target profile before attempting the move', async () => {
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
    expect(s.pendingAdoption).toEqual({ profileId: 'p1', count: 3 }) // kept, so a retry is possible
    expect(s.status).not.toBe('error') // isolated from the identity-level status
    // The consent write itself is not the thing that failed — it must
    // still be in place, exactly what lets a boot-time resume finish this
    // later even if the person never taps retry.
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

    expect(mUpdateSession).toHaveBeenCalledWith(
      { accessToken: 'tok', expiresAt: 1 },
      { email: 'a@b.com', name: 'Ana' },
    )
  })

  it('is a no-op when status is not idle, so it can only run once on boot', async () => {
    useAuthStore.setState({ status: 'authenticating' })

    await useAuthStore.getState().restore()

    expect(mToken).not.toHaveBeenCalled()
  })

  // prompt: '' is only silent when this client already holds a grant — on a
  // genuine first-ever visit it can surface real Google UI unprompted. Gate
  // the whole attempt on the login marker instead of firing unconditionally.
  it('does not attempt a silent restore before any login has ever succeeded on this device', async () => {
    mHasLoggedInBefore.mockResolvedValue(false)

    await useAuthStore.getState().restore()

    expect(mToken).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('idle')
  })

  it('attempts a silent restore once a login has succeeded on this device before', async () => {
    mHasLoggedInBefore.mockResolvedValue(true)
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().restore()

    expect(mToken).toHaveBeenCalledWith('')
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  // A silent restore re-establishes a real Google session too — it must
  // keep the registry's recency pointed at this account the same way an
  // explicit login() does.
  it('resolves this account in the profile registry on a successful silent restore', async () => {
    mHasLoggedInBefore.mockResolvedValue(true)
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

    await useAuthStore.getState().restore()

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'a@b.com', label: 'Ana' })
  })

  // Same race as login()'s own version of this test — restore()'s online
  // branch takes the identical authenticate()-then-set() shape.
  it('resolves the account in the profile registry before status flips to authenticated', async () => {
    mHasLoggedInBefore.mockResolvedValue(true)
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ sub: 'google-sub-1', email: 'a@b.com', name: 'Ana' })
    let resolveProfile!: () => void
    mResolveGoogleProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProfile = () => resolve({ id: 'p1' } as never)
        }),
    )

    const pending = useAuthStore.getState().restore()
    await vi.waitFor(() => expect(mResolveGoogleProfile).toHaveBeenCalled())
    expect(useAuthStore.getState().status).toBe('authenticating')

    resolveProfile()
    await pending

    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  // Same cold-start persistence as login() above, exercised via the silent
  // restore path instead of an explicit sign-in.
  it('resolves a previously persisted Drive decision and silently re-acquires Drive access', async () => {
    mHasLoggedInBefore.mockResolvedValue(true)
    mToken
      .mockResolvedValueOnce({ accessToken: 'identity-tok', expiresAt: 1 })
      .mockResolvedValueOnce({ accessToken: 'drive-tok', expiresAt: 2 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mGetDriveDecision.mockResolvedValue('connected')
    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })

    await useAuthStore.getState().restore()
    // Fire-and-forget, same as login() above — wait for it separately.
    await vi.waitFor(() => expect(useAuthStore.getState().drive).not.toBeNull())

    const s = useAuthStore.getState()
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive?.folderId).toBe('F')
    expect(s.session?.accessToken).toBe('drive-tok')
  })

  it('does not fail restore or surface driveError when the silent re-acquire fails', async () => {
    mHasLoggedInBefore.mockResolvedValue(true)
    mToken
      .mockResolvedValueOnce({ accessToken: 'identity-tok', expiresAt: 1 })
      .mockRejectedValueOnce(new Error('drive: 403'))
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mGetDriveDecision.mockResolvedValue('connected')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await useAuthStore.getState().restore()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.driveOptIn).toBe('connected')
    expect(s.drive).toBeNull()
    expect(s.driveError).toBeNull()
    warn.mockRestore()
  })

  // restore() answers a second question — "has this device used guest mode
  // before" — for a device that never logged in with Google. A returning
  // guest must land directly on `status: 'guest'`, never WelcomeScreen.
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

    it('falls back to idle when neither marker is set (a genuine first visit)', async () => {
      mHasLoggedInBefore.mockResolvedValue(false)
      mHasUsedGuestBefore.mockResolvedValue(false)

      await useAuthStore.getState().restore()

      expect(useAuthStore.getState().status).toBe('idle')
      expect(mToken).not.toHaveBeenCalled()
    })

    // With both markers set, the account wins: the account marker alone
    // must be enough to take the existing account-restore branch; the guest
    // marker being *also* true must not short-circuit into guest status.
    it('attempts the account restore when both markers are set, never guest status', async () => {
      mHasLoggedInBefore.mockResolvedValue(true)
      mHasUsedGuestBefore.mockResolvedValue(true)
      mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
      mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })

      await useAuthStore.getState().restore()

      expect(mToken).toHaveBeenCalledWith('')
      expect(useAuthStore.getState().status).toBe('authenticated')
    })

    it('does not enter guest status when the account restore fails, even with a guest marker present', async () => {
      mHasLoggedInBefore.mockResolvedValue(true)
      mHasUsedGuestBefore.mockResolvedValue(true)
      mToken.mockRejectedValue(new Error('access: no session'))

      await useAuthStore.getState().restore()

      expect(useAuthStore.getState().status).toBe('idle')
    })
  })

  // A returning user, offline, with no PIN lock enabled (so no vault to
  // decrypt) must not be stranded on WelcomeScreen.
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

  // A different Google account can sign in on this same device next — the
  // previous account's persisted Drive decision must not carry over to it.
  it('clears the persisted Drive decision so a different account on this device is asked again', () => {
    useAuthStore.setState({ driveOptIn: 'connected' })

    useAuthStore.getState().logout()

    expect(mClearDriveDecision).toHaveBeenCalledOnce()
  })

  // Without this, a stale 'ready' left in useBootStore from this session
  // survives into the next BootGate mount (a different account, or guest,
  // logging in next), rendering children instantly off that stale status
  // instead of waiting for the new boot to verify the resolved profile.
  it('invalidates the boot store so the next sign-in cannot reuse a stale "ready" from this session', () => {
    useAuthStore.getState().logout()

    expect(mInvalidateBootForSignOut).toHaveBeenCalledOnce()
  })

  // Clearing only in-memory state leaves the encrypted session cached
  // inside the PIN-lock vault intact, so a correct PIN after "signing out"
  // would resume that same cached session and land the user right back in
  // the account they just left — resetVault() is what actually removes it.
  it('invalidates the PIN-lock vault so a correct PIN cannot resurrect this account', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
    })

    useAuthStore.getState().logout()

    expect(mResetVault).toHaveBeenCalledOnce()
  })

  // A vault whose invalidation fails must never trap the user inside the
  // account they are trying to leave — logout()'s own state reset is
  // synchronous and does not wait on resetVault() at all; the failure must
  // still be logged, not silently lost.
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
    // Let the fire-and-forget invalidation settle before asserting it logged.
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

  // The recorded state must reflect what actually happened, not what was
  // attempted: the popup can succeed while Drive provisioning itself fails,
  // and that must not be recorded as 'connected'.
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

  // The vault decrypt that produced session/cachedUser already proved
  // identity locally — hydrate() must land on 'authenticated' from that
  // alone, with no network call awaited at all.
  it('authenticates synchronously from the cached session and profile, without touching Drive or the network', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    // A hung fetchGoogleUser would prove hydrate() is still gating on it if
    // this resolved without ever settling.
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, cachedUser)

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.session).toEqual(session)
    expect(s.user).toEqual(cachedUser)
    expect(s.drive).toBeNull()
    expect(mBootstrap).not.toHaveBeenCalled()
  })

  // A PIN unlock re-establishes this account's session — touching its
  // profile here is what keeps getActiveProfile()'s recency resolution
  // pointed at the right account across a lock/unlock cycle.
  it('resolves the cached profile in the registry, keyed by email', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(mResolveGoogleProfile).toHaveBeenCalledWith({ accountKey: 'a@b.com', label: 'Ana' })
  })

  // No cached profile is possible with no vault (the no-lock boot path) —
  // nothing to key a registry lookup on.
  it('does not resolve a profile when there is no cached user to key it on', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, null)

    expect(mResolveGoogleProfile).not.toHaveBeenCalled()
  })

  // A correct PIN with no network must reach 'authenticated', not 'error'.
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

    // Silent, same reasoning as restore()'s own catch: failing to refresh
    // while offline is the routine outcome for every biometric/PIN unlock
    // in airplane mode, not a symptom of something broken.
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
    // A realistic mid-session 'connected' state always has `drive` already
    // populated too (from connectDrive() or an earlier hydrate() this
    // session) — that's what the reacquire guard actually keys on.
    useAuthStore.setState({
      driveOptIn: 'connected',
      drive: { folderId: 'F' },
    })

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(useAuthStore.getState().driveOptIn).toBe('connected')
    // Already resolved this session — a mid-session re-lock/unlock must not
    // even touch storage, let alone re-derive a different answer from it,
    // and must not re-run the Drive re-acquire either (drive is already set).
    expect(mGetDriveDecision).not.toHaveBeenCalled()
    expect(mToken).not.toHaveBeenCalled()
    expect(mBootstrap).not.toHaveBeenCalled()
  })

  // The PIN-lock cold-start path: a fresh page load with a vault already
  // enrolled skips RequireAuth's own restore() entirely and lands directly
  // on hydrate() via lockStore.resume() — this is the *first* time driveOptIn
  // is resolved this session, so it must consult storage, unlike the
  // mid-session case above.
  it('resolves a previously persisted "dismissed" decision on a PIN-lock cold start', async () => {
    const session = { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('dismissed')
    useAuthStore.setState({ driveOptIn: 'pending' })

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(useAuthStore.getState().driveOptIn).toBe('dismissed')
  })

  // The vault's cached session is identity-only — a PIN-lock cold start for
  // a device that connected Drive in a previous session must re-fetch
  // `drive` itself, or driveOptIn === 'connected' would be a memory of a
  // past connection, not an honest signal Drive is usable.
  it('resolves a previously persisted "connected" decision and silently re-acquires Drive access', async () => {
    const session = { accessToken: 'identity-tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('connected')
    mToken.mockResolvedValue({ accessToken: 'drive-tok', expiresAt: 2 })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
    })
    useAuthStore.setState({ driveOptIn: 'pending' })

    await useAuthStore.getState().hydrate(session, cachedUser)
    // Fire-and-forget, same as login()/restore() above — wait for it separately.
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

  // The re-acquire must never be on hydrate()'s critical path — lockStore.
  // resume() awaits hydrate()'s whole promise before leaving `phase:
  // 'locked'`, so if hydrate() waited on this too, a correct PIN would hang
  // on a Drive network round trip with no busy state to explain it.
  it('settles without waiting on the silent re-acquire, even if it never resolves', async () => {
    const session = { accessToken: 'identity-tok', expiresAt: Date.now() + 3_600_000 }
    mGetDriveDecision.mockResolvedValue('connected')
    // A token request that never settles simulates a stalled network call —
    // bootstrap() has no timeout (src/lib/bootstrap.ts), so this is the
    // realistic worst case, not a contrived one.
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
    // A hung refresh proves this assertion is about the *synchronous* cache
    // write, not the fire-and-forget refresh's own (later) re-cache.
    mUser.mockImplementation(() => new Promise(() => {}))

    await useAuthStore.getState().hydrate(session, cachedUser)

    expect(mUpdateSession).toHaveBeenCalledWith(session, cachedUser)
  })

  // Same guard shape as connectDrive()'s own: a logout() firing while the
  // silent re-acquire's network round trip is still pending must not have
  // the reacquire's late result resurrect session/drive for an account
  // already signed out of.
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

  // A logout() firing while the fire-and-forget profile refresh is still in
  // flight must not resurrect `user` for an account already signed out of.
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

  // driveOptIn must not sit 'pending' for a guest — a future caller reading
  // driveOptIn alone, without checking status first, must not be misled
  // into re-prompting.
  it('resets driveOptIn away from a stale connected/dismissed value from a prior session', async () => {
    useAuthStore.setState({ driveOptIn: 'connected' })

    await useAuthStore.getState().continueAsGuest()

    expect(useAuthStore.getState().driveOptIn).toBe('pending')
  })

  // Without the explicit active-profile pointer, a device that signed out
  // of a Google account and chose "continue as guest" would resolve that
  // account's profile on the next boot (touched more recently than the
  // local one) and read/write guest movements into the wrong database.
  it('sets the active-profile pointer to the default local profile so a stale Google profile cannot win', async () => {
    await useAuthStore.getState().continueAsGuest()

    expect(mSetActiveProfileId).toHaveBeenCalledWith('kurobello')
  })

  // The device-local signal a returning guest is recognised by — without
  // this, choosing "continue as guest" would never persist past a reload.
  it('marks this device as having used guest mode', async () => {
    await useAuthStore.getState().continueAsGuest()

    expect(mMarkGuestUsed).toHaveBeenCalled()
  })

  // A build that flipped `status` to 'guest' before this write landed lost
  // the race against BootGate's effect-driven registry read on every run —
  // status must not flip until the write has resolved.
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
