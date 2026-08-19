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
// vault exists, and swallowed if the vault exists but isn't unlocked in this
// tab (a caching side effect, not the primary outcome of the call).
async function syncLockedSession(session: AuthSession): Promise<void> {
  if (!(await hasVault())) return
  try {
    await updateSession(session)
  } catch {
    // Best-effort cache refresh only — see comment above.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
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
  restore: async () => {
    try {
      const { session, user } = await authenticate('')
      set({ status: 'authenticated', session, user })
      await syncLockedSession(session)
    } catch {
      set({ status: 'idle' })
    }
  },
  logout: () =>
    set({
      status: 'idle',
      user: null,
      session: null,
      drive: null,
      error: null,
      driveOptIn: 'pending',
      driveConnecting: false,
      driveError: null,
    }),
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
    set({ driveConnecting: true, driveError: null })
    try {
      const session = await requestAccessToken('', DRIVE_SCOPES)
      const drive = await bootstrap(session.accessToken)
      set({ session, drive, driveOptIn: 'connected', driveConnecting: false })
      await syncLockedSession(session)
    } catch (e) {
      set({ driveConnecting: false, driveError: errorMessage(e) })
    }
  },
  dismissDrive: () => set({ driveOptIn: 'dismissed' }),
}))

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}
