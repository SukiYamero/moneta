import { create } from 'zustand'
import {
  requestAccessToken,
  fetchGoogleUser,
  DRIVE_SCOPES,
  type AuthSession,
  type GoogleUser,
} from '@/lib/auth'
import { bootstrap, type DriveLayout } from '@/lib/bootstrap'
import { hasVault, updateSession } from '@/lib/pinLock'

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error'
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
  login: () => Promise<void>
  restore: () => Promise<void>
  logout: () => void
  hydrate: (session: AuthSession) => Promise<void>
  connectDrive: () => Promise<void>
  dismissDrive: () => void
}

async function authenticate(prompt: '' | 'consent') {
  const session = await requestAccessToken(prompt)
  const user = await fetchGoogleUser(session.accessToken)
  return { session, user }
}

// Keeps the PIN-lock vault's cached token fresh whenever a new AuthSession
// lands, so an enabled lock stays convenient after the token first expires
// (specs.md §12). Must never fail the auth flow it rides on: a no-op when no
// vault exists, and best-effort if the vault exists but isn't unlocked in this
// tab (a caching side effect, not the primary outcome of the call) — so the
// whole body is one try, including the hasVault() read itself (an IndexedDB
// call that can throw on its own: Safari private mode, storage-quota errors, a
// blocking extension). Failures are logged, not swallowed silently, so a
// genuine vault problem stays visible without breaking the auth flow.
async function syncLockedSession(session: AuthSession): Promise<void> {
  try {
    if (!(await hasVault())) return
    await updateSession(session)
  } catch (e) {
    console.warn('lock: failed to sync the cached session', e)
  }
}

// logout() bumps this so a connectDrive() request already in flight can tell,
// on resolve, that it should discard its result instead of resurrecting state.
let authGeneration = 0

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  session: null,
  drive: null,
  error: null,
  driveOptIn: 'pending',
  driveConnecting: false,
  driveError: null,
  login: async () => {
    set({ status: 'authenticating', error: null })
    try {
      const { session, user } = await authenticate('consent')
      set({ status: 'authenticated', session, user, driveOptIn: 'pending' })
      await syncLockedSession(session)
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  // Silent re-auth for the no-lock boot path (specs.md §5): RequireAuth calls
  // this once on mount, only while status is still 'idle'. When a PIN lock is
  // enabled, lockStore.resume() already owns restoring the session on unlock —
  // it never leaves status at 'idle', so this guard also keeps the two restore
  // paths from racing each other.
  restore: async () => {
    if (get().status !== 'idle') return
    set({ status: 'authenticating' })
    try {
      const { session, user } = await authenticate('')
      set({ status: 'authenticated', session, user })
      await syncLockedSession(session)
    } catch {
      set({ status: 'idle' })
    }
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
  },
  // Fires on a mid-session re-lock/unlock too (Page Visibility timeout,
  // §10.2), not only on cold start — driveOptIn is deliberately left
  // untouched so unlocking never re-triggers the Drive-permission screen.
  hydrate: async (session) => {
    set({ status: 'authenticating', error: null })
    try {
      const user = await fetchGoogleUser(session.accessToken)
      set({ status: 'authenticated', session, user })
      await syncLockedSession(session)
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  connectDrive: async () => {
    const generation = authGeneration
    set({ driveConnecting: true, driveError: null })
    try {
      const session = await requestAccessToken('', DRIVE_SCOPES)
      const drive = await bootstrap(session.accessToken)
      // A logout() while this request was in flight must win — don't resurrect
      // a session/drive layout for an account the user already signed out of.
      if (generation !== authGeneration) return
      set({ session, drive, driveOptIn: 'connected', driveConnecting: false })
      await syncLockedSession(session)
    } catch (e) {
      if (generation !== authGeneration) return
      set({ driveConnecting: false, driveError: errorMessage(e) })
    }
  },
  dismissDrive: () => set({ driveOptIn: 'dismissed' }),
}))

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}
