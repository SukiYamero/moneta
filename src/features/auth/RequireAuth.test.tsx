import { StrictMode, type ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuthStore } from '@/lib/authStore'

// PreContentSkeleton (rendered whenever a returning device is still
// resolving) uses the real BottomNav, which needs a Router context — every
// real call site (router.tsx) already provides one; this is test-harness
// only.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter })

vi.mock('@/lib/deviceStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/deviceStore')>()
  return { ...actual, hasLoggedInBefore: vi.fn(), hasUsedGuestBefore: vi.fn() }
})

import { hasLoggedInBefore, hasUsedGuestBefore } from '@/lib/deviceStore'

const mHasLoggedInBefore = vi.mocked(hasLoggedInBefore)
const mHasUsedGuestBefore = vi.mocked(hasUsedGuestBefore)

beforeEach(() => {
  // Defaults to "never logged in before" — most tests exercise a genuine
  // first-run device; the returning-device tests below override it.
  mHasLoggedInBefore.mockResolvedValue(false)
  // Defaults to "never used guest mode" — the returning-guest tests below
  // override it.
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
    // RequireAuth attempts a silent restore on mount when idle — stub it
    // out by default so the other tests aren't exercising real auth.ts.
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

  // A modal over the settled app, not a second full-screen gate — children
  // render underneath it, not instead of it.
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
    // Already 'authenticated' at mount (e.g. a lock-screen unlock handoff) —
    // must not wait on hasLoggedInBefore() at all, which this test leaves
    // permanently pending to prove it.
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

    // Still the welcome screen, showing its own inline busy state — never a
    // full-screen boot placeholder.
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

    // Still booting for a known-returning device — the skeleton cover (its
    // `BottomNav`) must stay up, never Welcome, no matter how many times the
    // mount effect fired.
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

  // "Has this device been used before" draws on two markers, not one — a
  // returning guest must get the same skeleton-then-children treatment a
  // returning account holder already gets, never the first-run pitch.
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
      // The skeleton cover (its BottomNav), not a blank frame.
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

  // A returning device's app must never flash the Welcome screen while
  // either the marker read or restore() itself is still resolving —
  // exercised under adversarial, independently-controlled timing for both
  // signals rather than trusting them to happen to resolve in a safe order.
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

      // Marker still unknown: genuinely nothing to promise yet.
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
      expect(screen.queryByText('secret')).not.toBeInTheDocument()

      // Marker resolves true — restore() has not been kicked off yet at
      // this exact instant in a naive implementation; must still not be Welcome.
      act(() => resolveMarker(true))
      await waitFor(() => expect(restore).toHaveBeenCalledOnce())
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
      expect(screen.queryByText('secret')).not.toBeInTheDocument()

      // restore() fails silently (session truly lapsed) — lands on the
      // returning-user screen, never Welcome.
      act(() => {
        useAuthStore.setState({ status: 'idle' })
        resolveRestore()
      })
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /hola de nuevo/i })).toBeInTheDocument(),
      )
      // Distinct from WelcomeScreen even though both offer a guest path:
      // this screen's guest entry is gated behind a confirm dialog, and no
      // first-run legal copy renders alongside it.
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
