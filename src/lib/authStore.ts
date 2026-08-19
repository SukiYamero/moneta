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
import { hasLoggedInBefore, markLoggedIn } from '@/lib/loginMarker'

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

const authenticate = async (prompt: '' | 'consent') => {
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
const syncLockedSession = async (session: AuthSession): Promise<void> => {
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
  login: async () => {
    set({ status: 'authenticating', error: null })
    try {
      const { session, user } = await authenticate('consent')
      set({ status: 'authenticated', session, user, driveOptIn: 'pending' })
      await syncLockedSession(session)
      // Explicit, user-initiated success only — the signal restore() below
      // gates on (specs.md §11, 2026-08-19). markLoggedIn() self-catches, so
      // this can never fail the login it rides on.
      await markLoggedIn()
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  // Silent re-auth for the no-lock boot path (specs.md §5): RequireAuth calls
  // this once on mount, only while status is still 'idle'. When a PIN lock is
  // enabled, lockStore.resume() already owns restoring the session on unlock —
  // it never leaves status at 'idle', so this guard also keeps the two restore
  // paths from racing each other.
  //
  // Also gated on hasLoggedInBefore(): prompt: '' is only silent when this
  // client already holds a grant — on a genuine first-ever visit it can
  // surface real Google UI before the user clicks anything, and after a
  // lockout (pinLock.resetVault() clears the marker) it must NOT silently
  // sign the same account back in, or the lockout's forced re-login is
  // undone within about a second (specs.md §11, 2026-08-19, findings 4/6).
  restore: async () => {
    if (get().status !== 'idle') return
    // Claim 'authenticating' before the async marker read, not after: two
    // concurrent restore() calls both reading status 'idle' and only *then*
    // awaiting the marker would otherwise both pass this guard and both fire
    // authenticate('') — the exact race this synchronous-check-then-set
    // pairing existed to prevent in the first place.
    set({ status: 'authenticating' })
    if (!(await hasLoggedInBefore())) {
      set({ status: 'idle' })
      return
    }
    try {
      const { session, user } = await authenticate('')
      set({ status: 'authenticated', session, user })
      await syncLockedSession(session)
    } catch {
      // Deliberately silent, unlike syncLockedSession's console.warn
      // (docs/error-handling.md §2): a silent-auth attempt failing is the
      // routine, expected outcome for anyone without a live Google session
      // (most first visits), not a symptom of something broken — logging it
      // would be noise on every such visit, not a signal. It also isn't the
      // last word on whether login works: falling back to 'idle' shows
      // WelcomeScreen, and an explicit login() from there has its own
      // error-visible path (status: 'error', §7's error-copy mapping) if
      // the real problem persists.
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
