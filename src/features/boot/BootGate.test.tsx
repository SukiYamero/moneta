import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useBootStore } from '@/lib/boot'
import { BootGate } from '@/features/boot/BootGate'

// PreContentSkeleton uses the real BottomNav, which needs a Router context —
// every real call site (router.tsx) already provides one; test-harness only.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter })

beforeEach(() => {
  useBootStore.setState({ status: 'idle', error: null, run: vi.fn().mockResolvedValue(undefined) })
})

describe('BootGate', () => {
  it('calls run() once on mount', () => {
    const run = vi.fn().mockResolvedValue(undefined)
    useBootStore.setState({ run })
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    expect(run).toHaveBeenCalledOnce()
  })

  // No full-screen loading treatment at all — the same shell+skeleton
  // cover RequireAuth uses, never a distinct brand screen.
  it('shows the shell+skeleton cover while status is idle/running, never the children', () => {
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    expect(screen.queryByText('app')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('reveals children the instant status becomes ready — no floor, no delay', () => {
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    act(() => {
      useBootStore.setState({ status: 'ready' })
    })
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('shows the error screen on a boot failure', () => {
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    act(() => {
      useBootStore.setState({ status: 'error', error: 'network' })
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('app')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('retrying from the error screen calls run() again', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    useBootStore.setState({ status: 'error', error: 'unknown', run })
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    run.mockClear()
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.click(screen.getByRole('button'))
    expect(run).toHaveBeenCalledOnce()
  })

  it('a remount that finds boot already ready renders children instantly, never showing the cover', () => {
    useBootStore.setState({ status: 'ready' })
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    expect(screen.getByText('app')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  // `status` is a module-global store, not scoped to "ready for the profile
  // currently bound". A `BootGate` mounted while `status` is still 'ready'
  // from a previous boot session must not render `children` instantly off
  // that stale value — `authStore.ts`'s `logout()` resets it via
  // `invalidateBootForSignOut()` before a next sign-in can remount this.
  it('after an invalidated boot, a fresh mount stays covered through run() rather than assuming stale readiness', () => {
    let flipToRunning: () => void = () => {}
    const run = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          flipToRunning = () => {
            useBootStore.setState({ status: 'running', error: null })
            resolve()
          }
        }),
    )
    // The post-logout starting state invalidateBootForSignOut() produces.
    useBootStore.setState({ status: 'idle', error: null, run })

    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    expect(screen.queryByText('app')).not.toBeInTheDocument()

    act(() => {
      flipToRunning()
    })
    // Mid-boot for this mount (a rebind's reset+reload window) — must stay covered.
    expect(screen.queryByText('app')).not.toBeInTheDocument()

    act(() => {
      useBootStore.setState({ status: 'ready' })
    })
    expect(screen.getByText('app')).toBeInTheDocument()
  })
})
