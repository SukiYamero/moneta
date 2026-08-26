import { StrictMode, type ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuthStore } from '@/lib/authStore'

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter })

vi.mock('@/lib/deviceStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/deviceStore')>()
  return { ...actual, hasLoggedInBefore: vi.fn(), hasUsedGuestBefore: vi.fn() }
})

import { hasLoggedInBefore, hasUsedGuestBefore } from '@/lib/deviceStore'

const mHasLoggedInBefore = vi.mocked(hasLoggedInBefore)
const mHasUsedGuestBefore = vi.mocked(hasUsedGuestBefore)

beforeEach(() => {
  mHasLoggedInBefore.mockResolvedValue(false)
  mHasUsedGuestBefore.mockResolvedValue(false)
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
    restore: vi.fn().mockResolvedValue(undefined),
  })
})

describe('RequireAuth', () => {
  it('shows the welcome screen when unauthenticated', async () => {
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls login when the welcome screen button is clicked', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  it('shows a welcome-screen error message when status is error', async () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelaste el inicio de sesión/i)
  })

  it('shows the Drive permission screen right after login, before the app', () => {
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'pending' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /permitir y continuar/i })).toBeInTheDocument()
  })

  it.each(['connected', 'dismissed'] as const)(
    'renders children once driveOptIn is %s',
    (driveOptIn) => {
      useAuthStore.setState({ status: 'authenticated', driveOptIn })
      render(
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>,
      )
      expect(screen.getByText('secret')).toBeInTheDocument()
    },
  )

  it('renders the guest-adoption prompt alongside children, once Drive opt-in is resolved, when there is a pending offer', () => {
    useAuthStore.setState({
      status: 'authenticated',
      driveOptIn: 'connected',
      pendingAdoption: { profileId: 'p1', count: 4 },
    })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders no adoption dialog when there is nothing pending — the overwhelmingly common case', () => {
    useAuthStore.setState({
      status: 'authenticated',
      driveOptIn: 'connected',
      pendingAdoption: null,
    })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders authenticated children instantly, never gated on the returning-device marker', () => {
    mHasLoggedInBefore.mockReturnValue(new Promise(() => {}))
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'connected' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('attempts a silent restore once on mount while status is idle', async () => {
    const restore = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ restore })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    await waitFor(() => expect(restore).toHaveBeenCalledOnce())
  })

  it('does not attempt a silent restore when a lock-screen unlock already settled status', () => {
    const restore = vi.fn()
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'connected', restore })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(restore).not.toHaveBeenCalled()
  })

  it('never flashes the Drive screen for a device that already answered', async () => {
    let resolveRestore: () => void = () => {}
    const restore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRestore = resolve
        }),
    )
    useAuthStore.setState({ restore })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /permitir y continuar/i })).not.toBeInTheDocument()

    act(() => {
      useAuthStore.setState({ status: 'authenticated', driveOptIn: 'connected' })
      resolveRestore()
    })

    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /permitir y continuar/i })).not.toBeInTheDocument()
  })

  it('renders children directly for a guest, skipping both Welcome and Drive screens', () => {
    useAuthStore.setState({ status: 'guest', driveOptIn: 'pending' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /permitir y continuar/i })).not.toBeInTheDocument()
  })

  it('keeps the welcome screen on screen when login() is triggered from it, instead of swapping in a boot placeholder', async () => {
    const login = vi.fn(() => {
      useAuthStore.setState({ status: 'authenticating' })
      return Promise.resolve()
    })
    useAuthStore.setState({ login })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    const googleButton = await screen.findByRole('button', { name: /google/i })

    await userEvent.click(googleButton)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conectando/i })).toBeInTheDocument()
  })

  it('does not end the boot window early under StrictMode double-invocation while the real restore() is still pending', async () => {
    let resolveRestore: () => void = () => {}
    const restore = vi.fn(() => {
      useAuthStore.setState({ status: 'authenticating' })
      return new Promise<void>((resolve) => {
        resolveRestore = resolve
      })
    })
    useAuthStore.setState({ restore })
    mHasLoggedInBefore.mockResolvedValue(true)

    render(
      <StrictMode>
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>
      </StrictMode>,
    )

    await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()

    act(() => {
      useAuthStore.setState({ status: 'idle' })
      resolveRestore()
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /hola de nuevo/i })).toBeInTheDocument(),
    )
  })

  describe('the returning guest', () => {
    it('covers a returning-guest cold start with the skeleton while restore() resolves, never Welcome', async () => {
      mHasUsedGuestBefore.mockResolvedValue(true)
      let resolveRestore: () => void = () => {}
      const restore = vi.fn(() => {
        useAuthStore.setState({ status: 'authenticating' })
        return new Promise<void>((resolve) => {
          resolveRestore = resolve
        })
      })
      useAuthStore.setState({ restore })

      render(
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>,
      )

      await waitFor(() => expect(restore).toHaveBeenCalledOnce())
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
      expect(screen.queryByText('secret')).not.toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      act(() => {
        useAuthStore.setState({ status: 'guest' })
        resolveRestore()
      })

      await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument())
    })

    it('renders children directly once a returning guest is recognised, without waiting on the account marker path', async () => {
      mHasUsedGuestBefore.mockResolvedValue(true)
      const restore = vi.fn(() => {
        useAuthStore.setState({ status: 'guest' })
        return Promise.resolve()
      })
      useAuthStore.setState({ restore })

      render(
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>,
      )

      await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
    })

    it('never shows the skeleton for a device that has used neither Google nor guest mode', async () => {
      mHasLoggedInBefore.mockResolvedValue(false)
      mHasUsedGuestBefore.mockResolvedValue(false)

      render(
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>,
      )

      expect(await screen.findByRole('button', { name: /google/i })).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })
  })

  describe('boot-flash regression', () => {
    it('never renders Welcome while a known-returning device is still resolving, in any interleaving', async () => {
      let resolveMarker: (v: boolean) => void = () => {}
      mHasLoggedInBefore.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveMarker = resolve
        }),
      )
      let resolveRestore: () => void = () => {}
      const restore = vi.fn(() => {
        useAuthStore.setState({ status: 'authenticating' })
        return new Promise<void>((resolve) => {
          resolveRestore = resolve
        })
      })
      useAuthStore.setState({ restore })

      render(
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>,
      )

      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
      expect(screen.queryByText('secret')).not.toBeInTheDocument()

      act(() => resolveMarker(true))
      await waitFor(() => expect(restore).toHaveBeenCalledOnce())
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
      expect(screen.queryByText('secret')).not.toBeInTheDocument()

      act(() => {
        useAuthStore.setState({ status: 'idle' })
        resolveRestore()
      })
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /hola de nuevo/i })).toBeInTheDocument(),
      )
      expect(screen.queryByRole('button', { name: /términos/i })).not.toBeInTheDocument()
    })

    it('never renders Welcome for a known-returning device whose restore() succeeds', async () => {
      mHasLoggedInBefore.mockResolvedValue(true)
      let resolveRestore: () => void = () => {}
      const restore = vi.fn(() => {
        useAuthStore.setState({ status: 'authenticating' })
        return new Promise<void>((resolve) => {
          resolveRestore = resolve
        })
      })
      useAuthStore.setState({ restore })

      render(
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>,
      )

      await waitFor(() => expect(restore).toHaveBeenCalledOnce())
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()

      act(() => {
        useAuthStore.setState({ status: 'authenticated', driveOptIn: 'dismissed' })
        resolveRestore()
      })

      await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
    })
  })
})
