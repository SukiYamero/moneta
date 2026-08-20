import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useBootStore } from '@/lib/boot'
import { BootGate } from '@/features/boot/BootGate'

beforeEach(() => {
  useBootStore.setState({ status: 'idle', error: null, run: vi.fn().mockResolvedValue(undefined) })
})

afterEach(() => {
  vi.useRealTimers()
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

  it('shows the boot screen while status is idle/running, never the children', () => {
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    expect(screen.queryByText('app')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('a fast boot still shows the brand screen for the ~800ms floor, then reveals children', () => {
    vi.useFakeTimers()
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    act(() => {
      useBootStore.setState({ status: 'ready' })
    })
    // Ready almost immediately — the floor must still hold the screen up.
    expect(screen.queryByText('app')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(799)
    })
    expect(screen.queryByText('app')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('a slow boot holds the screen past the floor until the work is actually done — it never hides on a timer while pending', () => {
    vi.useFakeTimers()
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    // Floor has long elapsed, but status is still 'idle'/'running' — must
    // still be the brand screen, never children, never a blank screen.
    expect(screen.queryByText('app')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      useBootStore.setState({ status: 'ready' })
    })
    // Floor requirement already satisfied — reveals immediately, no extra wait.
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('shows the error screen immediately on a boot failure, bypassing the floor', () => {
    vi.useFakeTimers()
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

  it('a remount that finds boot already ready renders children instantly, never re-showing the brand screen', () => {
    useBootStore.setState({ status: 'ready' })
    render(
      <BootGate>
        <div>app</div>
      </BootGate>,
    )
    expect(screen.getByText('app')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // CONFIRMED (track-boot review, reproduced before the fix): `status` is a
  // module-global store, not scoped to "ready for the profile currently
  // bound". A `BootGate` mounted while `status` is still 'ready' from a
  // *previous* boot session renders `children` instantly off that stale
  // value and never re-covers the screen even once `run()` later detects a
  // rebind and starts resetting/reloading data underneath it — exactly the
  // "even transiently" case specs.md §10.28's rebind path exists to
  // prevent. This is why `authStore.ts`'s `logout()` calls
  // `invalidateBootForSignOut()` (`src/lib/boot.ts`) before the next
  // sign-in can ever remount `BootGate` — this test pins down what that
  // reset actually buys: a mount starting from the state logout() leaves
  // behind must show the brand screen until a genuine boot for *this*
  // mount finishes, not before.
  it('after an invalidated boot, a fresh mount stays covered through run() rather than assuming stale readiness', () => {
    vi.useFakeTimers()
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
    // The exact post-logout starting state invalidateBootForSignOut()
    // produces — not the stale 'ready' a pre-fix mount would have inherited.
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
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(screen.getByText('app')).toBeInTheDocument()
  })
})
