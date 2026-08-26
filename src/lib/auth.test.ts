import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  requestAccessToken,
  fetchGoogleUser,
  AuthError,
  DRIVE_SCOPES,
  IDENTITY_SCOPES,
} from '@/lib/auth'

type Cb = (resp: { access_token?: string; expires_in?: number; error?: string }) => void
type ErrCb = (err: { type: string }) => void

let lastInit: { scope: string; callback: Cb; error_callback?: ErrCb } | null = null

beforeEach(() => {
  lastInit = null
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com')
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: { scope: string; callback: Cb; error_callback?: ErrCb }) => {
          lastInit = cfg
          return { requestAccessToken: vi.fn() }
        },
      },
    },
  })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-25T00:00:00Z'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('requestAccessToken', () => {
  it('defaults to identity-only scopes — no Drive access at login', async () => {
    const p = requestAccessToken('consent')
    lastInit!.callback({ access_token: 'tok', expires_in: 3600 })
    await p
    expect(IDENTITY_SCOPES).toBe('openid email profile')
    expect(lastInit!.scope).toBe(IDENTITY_SCOPES)
    expect(lastInit!.scope).not.toContain('drive')
  })

  it('requests Drive scopes only when asked explicitly (incremental auth)', async () => {
    const p = requestAccessToken('', DRIVE_SCOPES)
    lastInit!.callback({ access_token: 'tok', expires_in: 3600 })
    await p
    expect(DRIVE_SCOPES).toBe(
      'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
    )
    expect(lastInit!.scope).toBe(DRIVE_SCOPES)
  })

  it('resolves with the token and a computed expiry', async () => {
    const p = requestAccessToken('')
    lastInit!.callback({ access_token: 'tok', expires_in: 3600 })
    const session = await p
    expect(session.accessToken).toBe('tok')
    expect(session.expiresAt).toBe(Date.parse('2026-06-25T00:00:00Z') + 3600 * 1000)
  })

  it('rejects with AuthError when the response carries an error', async () => {
    const p = requestAccessToken('')
    lastInit!.callback({ error: 'access_denied' })
    await expect(p).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects with AuthError when the user cancels (error_callback)', async () => {
    const p = requestAccessToken('')
    lastInit!.error_callback!({ type: 'popup_closed' })
    await expect(p).rejects.toBeInstanceOf(AuthError)
  })
})

describe('fetchGoogleUser', () => {
  it('reads identity from the userinfo endpoint with a Bearer token', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({ sub: 'google-sub-1', email: 'a@b.com', name: 'Ana', picture: 'p' }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = await fetchGoogleUser('tok')
    expect(user).toEqual({ sub: 'google-sub-1', email: 'a@b.com', name: 'Ana', photoLink: 'p' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/oauth2/v3/userinfo')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('carries the OIDC subject id through, distinct from the mutable email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ sub: 'stable-id', email: 'renamed@b.com', name: 'Ana' }), {
            status: 200,
          }),
      ),
    )
    const user = await fetchGoogleUser('tok')
    expect(user.sub).toBe('stable-id')
    expect(user.email).toBe('renamed@b.com')
  })

  it('throws AuthError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )
    await expect(fetchGoogleUser('tok')).rejects.toBeInstanceOf(AuthError)
  })
})
