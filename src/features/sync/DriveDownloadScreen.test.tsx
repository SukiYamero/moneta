import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNetworkStore } from '@/lib/networkStore'
import { useSyncStore } from '@/lib/sync/engine'

vi.mock('@/lib/sync/syncSession', () => ({ getSyncContext: vi.fn() }))
vi.mock('@/lib/sync/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sync/engine')>()
  return { ...actual, pull: vi.fn() }
})

import { getSyncContext } from '@/lib/sync/syncSession'
import { pull } from '@/lib/sync/engine'
import { DriveDownloadScreen } from '@/features/sync/DriveDownloadScreen'

const mGetSyncContext = vi.mocked(getSyncContext)
const mPull = vi.mocked(pull)

const ctx = { token: 'tok', profile: { id: 'p1' } as never, locale: 'en' as const }

beforeEach(() => {
  vi.clearAllMocks()
  useNetworkStore.setState({ online: true })
  useSyncStore.setState({
    phase: 'idle',
    pullProgress: null,
    lastError: null,
    lastPullSummary: null,
  })
})

afterEach(() => {
  useNetworkStore.setState({ online: true })
})

describe('DriveDownloadScreen', () => {
  it('shows the offline message and never attempts a pull while offline', () => {
    useNetworkStore.setState({ online: false })
    render(<DriveDownloadScreen onDone={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
    expect(mGetSyncContext).not.toHaveBeenCalled()
  })

  it('attempts a pull on mount and calls onDone on success', async () => {
    mGetSyncContext.mockResolvedValue(ctx)
    mPull.mockResolvedValue({ filesReconciled: 0, revivedMovIds: [], skippedEntries: 0 })
    const onDone = vi.fn()

    render(<DriveDownloadScreen onDone={onDone} />)

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(mPull).toHaveBeenCalledWith('tok', ctx.profile, 'en')
  })

  it('shows real progress from the sync store while the pull is in flight', () => {
    mGetSyncContext.mockReturnValue(new Promise(() => {})) // never resolves — stays "in flight"
    useSyncStore.setState({ pullProgress: { done: 2, total: 5 } })

    render(<DriveDownloadScreen onDone={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('2 de 5 archivos')
  })

  it('shows a failure state with retry when the pull rejects — never a silent fall-through', async () => {
    mGetSyncContext.mockResolvedValue(ctx)
    mPull.mockRejectedValue(new Error('network blip'))

    render(<DriveDownloadScreen onDone={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos traer tus datos')
  })

  it('retry re-attempts the pull', async () => {
    const user = userEvent.setup()
    mGetSyncContext.mockResolvedValue(ctx)
    mPull.mockRejectedValueOnce(new Error('network blip'))
    mPull.mockResolvedValueOnce({ filesReconciled: 0, revivedMovIds: [], skippedEntries: 0 })
    const onDone = vi.fn()

    render(<DriveDownloadScreen onDone={onDone} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(mPull).toHaveBeenCalledTimes(2)
  })

  it('"continue without Drive" calls onDone without a successful pull', async () => {
    const user = userEvent.setup()
    mGetSyncContext.mockResolvedValue(ctx)
    mPull.mockRejectedValue(new Error('network blip'))
    const onDone = vi.fn()

    render(<DriveDownloadScreen onDone={onDone} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Continuar sin Drive por ahora' }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
