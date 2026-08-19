import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuthStore } from '@/lib/authStore'

beforeEach(() => {
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
    // RequireAuth attempts a silent restore on mount when idle (see below) —
    // stub it out by default so the other tests aren't exercising real auth.ts.
    restore: vi.fn().mockResolvedValue(undefined),
  })
})

describe('RequireAuth', () => {
  it('shows the welcome screen when unauthenticated', () => {
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls login when the welcome screen button is clicked', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    await userEvent.click(screen.getByRole('button', { name: /google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  it('shows a welcome-screen error message when status is error', () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/cancelaste el inicio de sesión/i)
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

  it('renders children once Drive sync is connected', () => {
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'connected' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders children once the Drive prompt is dismissed for the session', () => {
    useAuthStore.setState({ status: 'authenticated', driveOptIn: 'dismissed' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('attempts a silent restore once on mount while status is idle', () => {
    const restore = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ restore })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(restore).toHaveBeenCalledOnce()
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

  // The persisted decision (specs.md §11, 2026-08-19) is resolved inside
  // authStore's own async login/restore/hydrate — by the time `status`
  // flips to 'authenticated', `driveOptIn` is already whatever storage said.
  // This pins down the resulting contract from RequireAuth's side: as long
  // as the store transitions both fields in the same `set()` call, a device
  // that already answered must never render DrivePermissionScreen at all,
  // not even for one intermediate render.
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
    // Still resolving — neither the app nor the Drive screen has any answer yet.
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /permitir y continuar/i })).not.toBeInTheDocument()

    // authStore resolves status and the persisted driveOptIn together, in one
    // set() call — never a separate render where status is 'authenticated'
    // but driveOptIn hasn't caught up yet.
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

  // The real boot-flash bug this track owns (specs.md §10.9): status is
  // 'authenticating' for the whole duration of restore()'s network calls,
  // not just the instant before/after — WelcomeScreen must not render for
  // any of that window.
  it('does not flash the welcome screen while status is authenticating', () => {
    useAuthStore.setState({ status: 'authenticating' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
