import { create } from 'zustand'
import {
  AuthError,
  requestAccessToken,
  fetchGoogleUser,
  DRIVE_SCOPES,
  type AuthSession,
  type GoogleUser,
} from '@/lib/auth'
import { bootstrap, type DriveLayout } from '@/lib/bootstrap'
import { invalidateBootForSignOut } from '@/lib/boot'
import { hasVault, resetVault, updateSession } from '@/lib/pinLock'
import {
  countUnadoptedGuestMovements,
  finishConsentedAdoption,
  getProfile,
  getProfileDatabase,
  resolveGoogleProfile,
  setActiveProfileId,
  DEFAULT_PROFILE_ID,
} from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
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
import { useNetworkStore } from '@/lib/networkStore'

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'guest' | 'error'
export type DriveOptIn = 'pending' | 'connected' | 'dismissed'

type AuthState = {
  status: AuthStatus
  user: GoogleUser | null
  session: AuthSession | null
  drive: DriveLayout | null
  error: string | null
  driveOptIn: DriveOptIn
  driveConnecting: boolean
  driveError: string | null
  pendingAdoption: { profileId: string; count: number } | null
  adoptionBusy: boolean
  adoptionError: string | null
  login: () => Promise<void>
  restore: () => Promise<void>
  logout: () => void
  continueAsGuest: () => void
  hydrate: (session: AuthSession, cachedUser: GoogleUser | null) => Promise<void>
  connectDrive: () => Promise<void>
  dismissDrive: () => void
  acceptGuestAdoption: () => Promise<void>
  declineGuestAdoption: () => void
}

const isNetworkShapedAuthFailure = (e: unknown): boolean => {
  if (e instanceof AuthError) return e.message === 'auth: GIS failed to load'
  return true
}

const authenticate = async (prompt: '' | 'consent') => {
  try {
    const session = await requestAccessToken(prompt)
    const user = await fetchGoogleUser(session.accessToken)
    useNetworkStore.getState().reportOnlineSuccess()
    return { session, user }
  } catch (e) {
    if (isNetworkShapedAuthFailure(e)) useNetworkStore.getState().reportOnlineFailure()
    throw e
  }
}

const syncLockedSession = async (session: AuthSession, user: GoogleUser | null): Promise<void> => {
  try {
    if (!(await hasVault())) return
    await updateSession(session, user)
  } catch (e) {
    console.warn('lock: failed to sync the cached session', e)
  }
}

const invalidateVaultOnLogout = async (): Promise<void> => {
  try {
    await resetVault()
  } catch (e) {
    console.error('lock: failed to invalidate the vault on sign-out', e)
  }
}

export const accountKeyOf = (user: GoogleUser | null): string | undefined =>
  user ? (user.sub ?? user.email) : undefined

const syncProfileForAccount = async (user: GoogleUser | null): Promise<ProfileRecord | null> => {
  if (!user) return null
  try {
    const record = await resolveGoogleProfile({
      accountKey: user.sub ?? user.email,
      label: user.name,
    })
    await setActiveProfileId(record.id)
    return record
  } catch (e) {
    console.warn('profiles: failed to resolve the profile for this account', e)
    return null
  }
}

const checkGuestAdoption = async (
  target: ProfileRecord,
): Promise<{ profileId: string; count: number } | null> => {
  try {
    if (await hasDeclinedAdoption()) return null
    const count = await countUnadoptedGuestMovements(getProfileDatabase(target.databaseName))
    if (count === 0) return null
    return { profileId: target.id, count }
  } catch (e) {
    console.warn('adoption: could not check for local guest data to offer', e)
    return null
  }
}

const resolveDriveOptIn = async (current: DriveOptIn): Promise<DriveOptIn> => {
  if (current !== 'pending') return current
  return (await getDriveDecision()) ?? 'pending'
}

const requestDriveSession = async (): Promise<{ session: AuthSession; drive: DriveLayout }> => {
  const session = await requestAccessToken('', DRIVE_SCOPES)
  const drive = await bootstrap(session.accessToken)
  return { session, drive }
}

const reacquireDrive = async (): Promise<{ session: AuthSession; drive: DriveLayout } | null> => {
  try {
    return await requestDriveSession()
  } catch (e) {
    console.warn('drive: could not silently re-acquire a previously connected Drive session', e)
    return null
  }
}

const reacquireDriveIfNeeded = async (
  driveOptIn: DriveOptIn,
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState,
): Promise<void> => {
  if (driveOptIn !== 'connected' || get().drive !== null) return
  const generation = authGeneration
  const reacquired = await reacquireDrive()
  if (!reacquired || generation !== authGeneration) return
  set({ session: reacquired.session, drive: reacquired.drive })
  await syncLockedSession(reacquired.session, get().user)
}

const refreshProfile = async (
  session: AuthSession,
  generation: number,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> => {
  try {
    const user = await fetchGoogleUser(session.accessToken)
    useNetworkStore.getState().reportOnlineSuccess()
    if (generation !== authGeneration) return
    set({ user })
    await syncLockedSession(session, user)
  } catch (e) {
    if (isNetworkShapedAuthFailure(e)) {
      useNetworkStore.getState().reportOnlineFailure()
      return
    }
    console.warn('auth: could not refresh the cached profile', e)
  }
}

let authGeneration = 0

const errorMessage = (e: unknown): string => {
  return e instanceof Error ? e.message : 'unknown error'
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
  login: async () => {
    const generation = authGeneration
    set({ status: 'authenticating', error: null })
    try {
      const { session, user } = await authenticate('consent')
      const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
      if (generation !== authGeneration) return
      const resolvedProfile = await syncProfileForAccount(user)
      if (generation !== authGeneration) return
      set({ status: 'authenticated', session, user, driveOptIn })
      await syncLockedSession(session, user)
      void reacquireDriveIfNeeded(driveOptIn, set, get)
      await markLoggedIn()
      if (generation === authGeneration && resolvedProfile) {
        const pending = await checkGuestAdoption(resolvedProfile)
        if (generation === authGeneration && pending) set({ pendingAdoption: pending })
      }
      await clearGuestUsed()
    } catch (e) {
      if (generation !== authGeneration) return
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  restore: async () => {
    if (get().status !== 'idle') return
    set({ status: 'authenticating' })
    const generation = authGeneration
    if (!(await hasLoggedInBefore())) {
      if (await hasUsedGuestBefore()) {
        if (generation !== authGeneration) return
        set({
          status: 'guest',
          user: null,
          session: null,
          drive: null,
          error: null,
          driveOptIn: 'pending',
          driveConnecting: false,
          driveError: null,
        })
        return
      }
      if (generation !== authGeneration) return
      set({ status: 'idle' })
      return
    }
    if (!useNetworkStore.getState().online) {
      const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
      if (generation !== authGeneration) return
      set({ status: 'authenticated', session: null, user: null, driveOptIn, error: null })
      return
    }
    // A previously logged-in device always lands on ReturningUserScreen for an explicit tap —
    // no silent requestAccessToken('') attempt. GIS's "silent" mode still opens a visible popup
    // under iOS WebKit's third-party-cookie blocking, which looks like an unrequested login.
    if (generation !== authGeneration) return
    set({ status: 'idle' })
  },
  logout: () => {
    authGeneration += 1
    set({
      status: 'idle',
      user: null,
      session: null,
      drive: null,
      error: null,
      driveOptIn: 'pending',
      driveConnecting: false,
      driveError: null,
    })
    void clearDriveDecision()
    void invalidateVaultOnLogout()
    invalidateBootForSignOut()
  },
  continueAsGuest: async () => {
    authGeneration += 1
    const generation = authGeneration
    await setActiveProfileId(DEFAULT_PROFILE_ID)
    await markGuestUsed()
    if (generation !== authGeneration) return
    set({
      status: 'guest',
      user: null,
      session: null,
      drive: null,
      error: null,
      driveOptIn: 'pending',
      driveConnecting: false,
      driveError: null,
    })
  },
  hydrate: async (session, cachedUser) => {
    const generation = authGeneration
    const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
    if (generation !== authGeneration) return
    set({ status: 'authenticated', session, user: cachedUser, driveOptIn, error: null })
    await syncLockedSession(session, cachedUser)
    await syncProfileForAccount(cachedUser)
    void reacquireDriveIfNeeded(driveOptIn, set, get)
    void refreshProfile(session, generation, set)
  },
  connectDrive: async () => {
    const generation = authGeneration
    set({ driveConnecting: true, driveError: null })
    try {
      const { session, drive } = await requestDriveSession()
      if (generation !== authGeneration) return
      set({ session, drive, driveOptIn: 'connected', driveConnecting: false })
      await syncLockedSession(session, get().user)
      await setDriveDecision('connected')
    } catch (e) {
      if (generation !== authGeneration) return
      set({ driveConnecting: false, driveError: errorMessage(e) })
    }
  },
  dismissDrive: () => {
    set({ driveOptIn: 'dismissed' })
    void setDriveDecision('dismissed')
  },
  acceptGuestAdoption: async () => {
    const pending = get().pendingAdoption
    if (!pending) return
    set({ adoptionBusy: true, adoptionError: null })
    try {
      const target = await getProfile(pending.profileId)
      if (!target) throw new Error('adoption: target profile no longer exists in the registry')
      await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })
      await finishConsentedAdoption(target)
      set({ adoptionBusy: false, pendingAdoption: null })
    } catch (e) {
      set({ adoptionBusy: false, adoptionError: errorMessage(e) })
    }
  },
  declineGuestAdoption: () => {
    set({ pendingAdoption: null, adoptionError: null })
    void markAdoptionDeclined()
  },
}))
