import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { OutboxEntry } from '@/lib/outbox'

vi.mock('@/lib/outbox', () => ({ listPendingOperations: vi.fn() }))

import { listPendingOperations } from '@/lib/outbox'
import { useAuthStore } from '@/lib/authStore'
import { useSignOutConfirm } from '@/features/profile/useSignOutConfirm'

const mListPending = vi.mocked(listPendingOperations)

const entry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: crypto.randomUUID(),
  entity: 'movimiento',
  entityId: crypto.randomUUID(),
  hlc: '0000000000000-0000-device',
  basedOn: null,
  device: 'device',
  enqueuedAt: Date.now(),
  operation: { entity: 'movimiento', op: 'put', payload: {} as never },
  ...overrides,
})

beforeEach(() => {
  mListPending.mockResolvedValue([])
  useAuthStore.setState({ driveOptIn: 'pending', logout: vi.fn() })
})

afterEach(() => {
  vi.clearAllMocks()
})

// specs.md §10.20: the modal is a warning about data at risk of being
// stranded, not a generic "are you sure" — it only makes sense when there is
// something unsynced AND nowhere else (Drive) for it to be safe.
describe('useSignOutConfirm', () => {
  it('signs out directly, with no modal and no unsynced check, when Drive is connected', async () => {
    useAuthStore.setState({ driveOptIn: 'connected' })
    const { result } = renderHook(() => useSignOutConfirm())

    await act(async () => result.current.requestSignOut())

    expect(useAuthStore.getState().logout).toHaveBeenCalledOnce()
    expect(result.current.confirmOpen).toBe(false)
    expect(mListPending).not.toHaveBeenCalled()
  })

  it('signs out directly, with no modal, when Drive is not connected but nothing is unsynced', async () => {
    useAuthStore.setState({ driveOptIn: 'pending' })
    mListPending.mockResolvedValue([])
    const { result } = renderHook(() => useSignOutConfirm())

    await act(async () => result.current.requestSignOut())

    expect(useAuthStore.getState().logout).toHaveBeenCalledOnce()
    expect(result.current.confirmOpen).toBe(false)
  })

  it('opens the confirm modal, naming the real quantity, when unsynced data exists and Drive is not connected', async () => {
    useAuthStore.setState({ driveOptIn: 'dismissed' })
    mListPending.mockResolvedValue([entry(), entry()])
    const { result } = renderHook(() => useSignOutConfirm())

    await act(async () => result.current.requestSignOut())

    expect(useAuthStore.getState().logout).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(true)
    expect(result.current.pendingCount).toBe(2)
  })

  // Two queued operations against the *same* movement (e.g. edited twice
  // before syncing) must read as one movement, matching the modal's "N
  // movements exist only on this device" copy — not two.
  it('counts distinct movements, not raw outbox entries', async () => {
    const sharedId = 'same-movimiento'
    useAuthStore.setState({ driveOptIn: 'pending' })
    mListPending.mockResolvedValue([
      entry({ entityId: sharedId }),
      entry({ entityId: sharedId }),
      entry({ entityId: 'other' }),
    ])
    const { result } = renderHook(() => useSignOutConfirm())

    await act(async () => result.current.requestSignOut())

    expect(result.current.pendingCount).toBe(2)
  })

  // A queued config write is not a movement — it must not inflate the count
  // the modal's copy names.
  it('does not count non-movimiento outbox entries', async () => {
    useAuthStore.setState({ driveOptIn: 'pending' })
    mListPending.mockResolvedValue([
      entry({
        entity: 'config',
        entityId: 'config',
        operation: { entity: 'config', op: 'put', payload: {} as never },
      }),
    ])
    const { result } = renderHook(() => useSignOutConfirm())

    await act(async () => result.current.requestSignOut())

    expect(useAuthStore.getState().logout).toHaveBeenCalledOnce()
    expect(result.current.confirmOpen).toBe(false)
  })

  it('confirmSignOut closes the modal and signs out', async () => {
    useAuthStore.setState({ driveOptIn: 'pending' })
    mListPending.mockResolvedValue([entry()])
    const { result } = renderHook(() => useSignOutConfirm())
    await act(async () => result.current.requestSignOut())
    expect(result.current.confirmOpen).toBe(true)

    act(() => result.current.confirmSignOut())

    expect(result.current.confirmOpen).toBe(false)
    expect(useAuthStore.getState().logout).toHaveBeenCalledOnce()
  })

  it('cancelSignOut closes the modal without signing out', async () => {
    useAuthStore.setState({ driveOptIn: 'pending' })
    mListPending.mockResolvedValue([entry()])
    const { result } = renderHook(() => useSignOutConfirm())
    await act(async () => result.current.requestSignOut())
    expect(result.current.confirmOpen).toBe(true)

    act(() => result.current.cancelSignOut())

    expect(result.current.confirmOpen).toBe(false)
    expect(useAuthStore.getState().logout).not.toHaveBeenCalled()
  })

  // outbox.ts's own listPendingOperations() already degrades to `[]` on a
  // storage failure (self-catching) — this just pins down that the fallback
  // is "sign out, no warning" rather than "block sign-out on a broken read",
  // matching specs.md §10.20's "sign-out must still complete" posture.
  it('fails open (signs out without the modal) if the unsynced check itself comes back empty on failure', async () => {
    useAuthStore.setState({ driveOptIn: 'pending' })
    mListPending.mockResolvedValue([])
    const { result } = renderHook(() => useSignOutConfirm())

    await act(async () => result.current.requestSignOut())

    expect(useAuthStore.getState().logout).toHaveBeenCalledOnce()
  })
})
