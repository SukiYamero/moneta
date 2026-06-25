import { create } from 'zustand'
import { requestAccessToken, fetchGoogleUser, type AuthSession, type GoogleUser } from '@/lib/auth'
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
}

async function authenticate(prompt: '' | 'consent') {
  const session = await requestAccessToken(prompt)
  const [user, drive] = await Promise.all([
    fetchGoogleUser(session.accessToken),
    bootstrap(session.accessToken),
  ])
  return { session, user, drive }
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
      const { session, user, drive } = await authenticate('consent')
      set({ status: 'authenticated', session, user, drive })
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  restore: async () => {
    try {
      const { session, user, drive } = await authenticate('')
      set({ status: 'authenticated', session, user, drive })
    } catch {
      set({ status: 'idle' })
    }
  },
  logout: () => set({ status: 'idle', user: null, session: null, drive: null, error: null }),
}))

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}
