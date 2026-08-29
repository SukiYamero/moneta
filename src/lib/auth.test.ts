import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  requestAccessToken,
  fetchGoogleUser,
  AuthError,
  DRIVE_SCOPES,
  IDENTITY_SCOPES,
} from '@/lib/auth'

type Cb = (resp: {
  access_token?: string
  expires_in?: number
  error?: string
  scope?: string
}) => void
type ErrCb = (err: { type: string }) => void

let lastInit: { scope: string; callback: Cb; error_callback?: ErrCb } | null = null
const revokeMock = vi.fn((_token: string, done: () => void) => done())

beforeEach(() => {
  lastInit = null
  revokeMock.mockClear()
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com')
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: { scope: string; callback: Cb; error_callback?: ErrCb }) => {
          lastInit = cfg
          return { requestAccessToken: vi.fn() }
        },
        hasGrantedAllScopes: (resp: { scope?: string }, ...scopes: string[]) =>
          scopes.every((s) => (resp.scope ?? '').split(' ').includes(s)),
        revoke: revokeMock,
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
    lastInit!.callback({ access_token: 'tok', expires_in: 3600, scope: IDENTITY_SCOPES })
    await p
    expect(IDENTITY_SCOPES).toBe('openid email profile')
    expect(lastInit!.scope).toBe(IDENTITY_SCOPES)
    expect(lastInit!.scope).not.toContain('drive')
  })

  it('requests Drive scopes only when asked explicitly (incremental auth)', async () => {
    const p = requestAccessToken('', DRIVE_SCOPES)
    lastInit!.callback({ access_token: 'tok', expires_in: 3600, scope: DRIVE_SCOPES })
    await p
    expect(DRIVE_SCOPES).toBe(
      'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
    )
    expect(lastInit!.scope).toBe(DRIVE_SCOPES)
  })

  it('resolves with the token and a computed expiry', async () => {
    const p = requestAccessToken('')
    lastInit!.callback({ access_token: 'tok', expires_in: 3600, scope: IDENTITY_SCOPES })
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

  it('rejects and revokes the token when the user unchecks one of the requested Drive scopes', async () => {
    const p = requestAccessToken('', DRIVE_SCOPES)
    lastInit!.callback({
      access_token: 'tok',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/drive.file',
    })
    await expect(p).rejects.toMatchObject({ message: 'auth: partial_scope_grant' })
    expect(revokeMock).toHaveBeenCalledWith('tok', expect.any(Function))
  })

  it('does not revoke or reject when every requested scope was granted', async () => {
    const p = requestAccessToken('', DRIVE_SCOPES)
    lastInit!.callback({ access_token: 'tok', expires_in: 3600, scope: DRIVE_SCOPES })
    await expect(p).resolves.toMatchObject({ accessToken: 'tok' })
    expect(revokeMock).not.toHaveBeenCalled()
  })

  it('never checks granted scopes for identity-only requests, so Google not echoing "openid" back cannot block a login', async () => {
    const p = requestAccessToken('', IDENTITY_SCOPES)
    lastInit!.callback({ access_token: 'tok', expires_in: 3600, scope: 'email profile' })
    await expect(p).resolves.toMatchObject({ accessToken: 'tok' })
    expect(revokeMock).not.toHaveBeenCalled()
  })

  it('rejects even when revoke never calls its callback, so a stuck revoke cannot hang the promise forever', async () => {
    revokeMock.mockImplementationOnce(() => {})
    const p = requestAccessToken('', DRIVE_SCOPES)
    lastInit!.callback({
      access_token: 'tok',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/drive.file',
    })
    await expect(p).rejects.toMatchObject({ message: 'auth: partial_scope_grant' })
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
