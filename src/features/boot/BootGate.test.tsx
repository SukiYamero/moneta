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
})
