import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requestAccessToken: vi.fn(),
  fetchGoogleUser: vi.fn(),
}))
vi.mock('@/lib/bootstrap', () => ({ bootstrap: vi.fn() }))

import { requestAccessToken, fetchGoogleUser } from '@/lib/auth'
import { bootstrap } from '@/lib/bootstrap'
import { useAuthStore } from '@/lib/authStore'

const mToken = vi.mocked(requestAccessToken)
const mUser = vi.mocked(fetchGoogleUser)
const mBootstrap = vi.mocked(bootstrap)

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ status: 'idle', user: null, session: null, drive: null, error: null })
})

describe('useAuthStore.login', () => {
  it('transitions to authenticated with user, session and drive layout', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
      movimientosFileId: 'M',
      activosFileId: 'A',
      configFileId: 'C',
    })

    await useAuthStore.getState().login()

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.user).toEqual({ email: 'a@b.com', name: 'Ana' })
    expect(s.session?.accessToken).toBe('tok')
    expect(s.drive?.folderId).toBe('F')
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
})

describe('useAuthStore.restore', () => {
  it('silently authenticates with prompt "" and falls back to idle on failure', async () => {
    mToken.mockRejectedValue(new Error('access: no session'))
    await useAuthStore.getState().restore()
    expect(mToken).toHaveBeenCalledWith('')
    expect(useAuthStore.getState().status).toBe('idle')
  })
})

describe('useAuthStore.logout', () => {
  it('clears all session state', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
      drive: { folderId: 'F', movimientosFileId: 'M', activosFileId: 'A', configFileId: 'C' },
      error: null,
    })
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s).toMatchObject({ status: 'idle', user: null, session: null, drive: null })
  })
})
