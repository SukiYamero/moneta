import { create } from 'zustand'
import {
  requestAccessToken,
  fetchGoogleUser,
  DRIVE_SCOPES,
  type AuthSession,
  type GoogleUser,
} from '@/lib/auth'
import { bootstrap, type DriveLayout } from '@/lib/bootstrap'

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error'

type AuthState = {
  status: AuthStatus
  user: GoogleUser | null
  session: AuthSession | null
  drive: DriveLayout | null
  error: string | null
  login: () => Promise<void>
  restore: () => Promise<void>
  logout: () => void
  hydrate: (session: AuthSession) => Promise<void>
  connectDrive: () => Promise<void>
}

async function authenticate(prompt: '' | 'consent') {
  const session = await requestAccessToken(prompt)
  const user = await fetchGoogleUser(session.accessToken)
  return { session, user }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  session: null,
  drive: null,
  error: null,
  login: async () => {
    set({ status: 'authenticating', error: null })
    try {
      const { session, user } = await authenticate('consent')
      set({ status: 'authenticated', session, user })
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  restore: async () => {
    try {
      const { session, user } = await authenticate('')
      set({ status: 'authenticated', session, user })
    } catch {
      set({ status: 'idle' })
    }
  },
  logout: () => set({ status: 'idle', user: null, session: null, drive: null, error: null }),
  hydrate: async (session) => {
    set({ status: 'authenticating', error: null })
    try {
      const user = await fetchGoogleUser(session.accessToken)
      set({ status: 'authenticated', session, user })
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  connectDrive: async () => {
    const session = await requestAccessToken('', DRIVE_SCOPES)
    set({ session, drive: await bootstrap(session.accessToken) })
  },
}))

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}
