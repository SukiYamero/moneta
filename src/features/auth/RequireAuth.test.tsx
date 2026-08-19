import { StrictMode } from 'react'
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

  // Regression: the boot-flash fix above must not swallow an explicit,
  // user-initiated login. login() sets the exact same `status:
  // 'authenticating'` that a cold-boot restore() does, so a naive guard
  // that keys only off `status` would rip the whole WelcomeScreen out from
  // under the user's tap and replace it with the full-screen boot
  // placeholder — a regression against specs.md §10.9 tier 3 ("the busy
  // state lives on the control that was pressed... never a full-screen
  // overlay"; "WelcomeScreen's Google button already does the label swap;
  // that is the pattern").
  it('keeps the welcome screen on screen when login() is triggered from it, instead of swapping in the boot placeholder', async () => {
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
    // Let the mount-time restore() mock settle so the boot window has closed.
    await waitFor(() => expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /google/i }))

    // Still the welcome screen, showing its own inline busy state — not the
    // full-screen boot placeholder.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conectando/i })).toBeInTheDocument()
  })

  // StrictMode (main.tsx) double-invokes effects in dev: mount, run effect,
  // simulate unmount, remount, run effect again — same component instance,
  // so refs survive across the pair. A naive "settle the boot window in the
  // mount effect" implementation resolves this per *invocation*: the second
  // invocation sees `status` already flipped away from 'idle' by the first
  // invocation's synchronous pre-await work, takes the "not idle" branch,
  // and marks boot settled immediately — reopening the exact boot-flash bug
  // this track fixes, in dev only, for a slow restore(). The real restore()
  // call must be the only one whose settlement can end the boot window.
  it('does not end the boot window early under StrictMode double-invocation while the real restore() is still pending', async () => {
    let resolveRestore: () => void = () => {}
    // Mirrors the real restore(): flips status synchronously, before any
    // await, which is exactly what makes the second StrictMode invocation
    // see a non-'idle' status.
    const restore = vi.fn(() => {
      useAuthStore.setState({ status: 'authenticating' })
      return new Promise<void>((resolve) => {
        resolveRestore = resolve
      })
    })
    useAuthStore.setState({ restore })

    render(
      <StrictMode>
        <RequireAuth>
          <div>secret</div>
        </RequireAuth>
      </StrictMode>,
    )

    // Still booting — the boot placeholder must still be up, not the welcome
    // screen, no matter how many times the mount effect fired.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()

    act(() => {
      useAuthStore.setState({ status: 'idle' })
      resolveRestore()
    })

    await waitFor(() => expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument())
  })
})
