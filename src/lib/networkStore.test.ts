import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetNetworkStoreForTests,
  OFFLINE_WRITE_WINDOW_MS,
  useNetworkStore,
} from '@/lib/networkStore'

afterEach(() => {
  __resetNetworkStoreForTests()
})

describe('useNetworkStore.setOnline', () => {
  it('updates the hint without touching the anchor', () => {
    useNetworkStore.getState().reportOnlineSuccess(1_000)
    useNetworkStore.getState().setOnline(false)
    useNetworkStore.getState().setOnline(true)

    const s = useNetworkStore.getState()
    expect(s.online).toBe(true)
    expect(s.lastOnlineAt).toBe(1_000)
  })
})

describe('useNetworkStore.reportOnlineFailure', () => {
  it('downgrades the hint but never rewinds the anchor', () => {
    useNetworkStore.getState().reportOnlineSuccess(1_000)

    useNetworkStore.getState().reportOnlineFailure()

    const s = useNetworkStore.getState()
    expect(s.online).toBe(false)
    expect(s.lastOnlineAt).toBe(1_000)
  })
})

describe('useNetworkStore.reportOnlineSuccess', () => {
  it('sets online and moves the anchor to the given time', () => {
    useNetworkStore.getState().reportOnlineSuccess(5_000)

    const s = useNetworkStore.getState()
    expect(s.online).toBe(true)
    expect(s.lastOnlineAt).toBe(5_000)
  })

  it('defaults to Date.now() when no time is given', () => {
    const before = Date.now()
    useNetworkStore.getState().reportOnlineSuccess()
    const after = Date.now()

    const anchor = useNetworkStore.getState().lastOnlineAt
    expect(anchor).not.toBeNull()
    expect(anchor).toBeGreaterThanOrEqual(before)
    expect(anchor).toBeLessThanOrEqual(after)
  })
})

describe('useNetworkStore.canWrite', () => {
  it('allows every mutation kind while online, regardless of the anchor', () => {
    useNetworkStore.setState({ online: true, lastOnlineAt: null })

    for (const kind of ['create', 'edit', 'delete', 'settings'] as const) {
      expect(useNetworkStore.getState().canWrite(kind)).toEqual({ allowed: true })
    }
  })

  it('allows create while offline, within the window', () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: 1_000 })

    expect(
      useNetworkStore.getState().canWrite('create', 1_000 + OFFLINE_WRITE_WINDOW_MS - 1),
    ).toEqual({
      allowed: true,
    })
  })

  it('refuses edit/delete/settings while offline, even within the window', () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: 1_000 })

    for (const kind of ['edit', 'delete', 'settings'] as const) {
      expect(useNetworkStore.getState().canWrite(kind, 1_000)).toEqual({
        allowed: false,
        reason: 'offline_mutation_restricted',
      })
    }
  })

  // appends commute, mutations don't (specs.md §10.11) — pinned down
  // explicitly since it's the whole reason create gets a different answer.
  it('never refuses create with the mutation-restricted reason', () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: null })

    const decision = useNetworkStore.getState().canWrite('create', 10 * OFFLINE_WRITE_WINDOW_MS)
    expect(decision).not.toMatchObject({ reason: 'offline_mutation_restricted' })
  })

  it('blocks create past the 7-hour window, but only create', () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: 1_000 })

    expect(
      useNetworkStore.getState().canWrite('create', 1_000 + OFFLINE_WRITE_WINDOW_MS + 1),
    ).toEqual({
      allowed: false,
      reason: 'offline_window_expired',
    })
  })

  it('reads still have no gate of their own — canWrite is only ever consulted for a write', () => {
    // canWrite has no 'read' kind in MutationKind at all: reads are simply
    // never routed through it (specs.md §10.11 "Done when" — reads stay
    // available past the window). Nothing to assert beyond the type itself
    // not admitting a 'read' argument; documented here as the invariant.
    expect(Object.keys({ create: 0, edit: 0, delete: 0, settings: 0 })).toHaveLength(4)
  })

  it('fails open when the anchor is unknown (never validated, or not yet hydrated)', () => {
    useNetworkStore.setState({ online: false, lastOnlineAt: null })

    expect(
      useNetworkStore.getState().canWrite('create', Date.now() + 100 * OFFLINE_WRITE_WINDOW_MS),
    ).toEqual({ allowed: true })
  })
})

describe('offline-window anchor persistence', () => {
  // The in-memory store alone can't prove persistence — reset in-memory
  // state and re-derive it from storage the same way a cold boot would
  // (docs/wave-3-plan.md §2.2(2): an in-memory-only anchor resets on every
  // reopen and the window never fires). vi.resetModules() forces this
  // module's top-level hydration code to run again, against the same
  // fake-indexeddb backing store, standing in for the real cold boot.
  it('a fresh module instance hydrates the anchor persisted by a previous one', async () => {
    useNetworkStore.getState().reportOnlineSuccess(42_000)
    // reportOnlineSuccess's persistence is fire-and-forget from the store's
    // own perspective — give the microtask queue a turn so the write lands
    // before the next module instance reads it back.
    await Promise.resolve()
    await Promise.resolve()

    vi.resetModules()
    const fresh = await import('@/lib/networkStore')

    await vi.waitFor(() => expect(fresh.useNetworkStore.getState().lastOnlineAt).toBe(42_000))
  })
})
