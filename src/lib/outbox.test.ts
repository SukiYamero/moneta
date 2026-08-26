import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { createProfileDb, db } from '@/lib/db'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import {
  __resetOutboxClockForTests,
  __resetOutboxDatabaseForTests,
  clampOutboxClockToServer,
  enqueueOperation,
  listPendingOperations,
  observeRemoteHlc,
  removeOperations,
  setOutboxDatabase,
  useOutboxStore,
} from '@/lib/outbox'
import { __clearKnownTipsForTests, recordKnownTip } from '@/lib/sync/tip'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

afterEach(async () => {
  await db.outbox.clear()
  await deviceDb.deviceId.clear()
  await __clearKnownTipsForTests()
  __resetDeviceIdForTests()
  __resetOutboxClockForTests()
  __resetOutboxDatabaseForTests()
  useOutboxStore.setState({ dirty: false })
})

describe('enqueueOperation', () => {
  it('stamps a hlc, a device id, and a null basedOn for a brand-new entity', async () => {
    const m = movimiento()
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: m })

    const [entry] = await listPendingOperations()
    expect(entry).toBeDefined()
    expect(entry?.entity).toBe('movimiento')
    expect(entry?.entityId).toBe(m.id)
    expect(entry?.basedOn).toBeNull()
    expect(entry?.hlc).toMatch(/^[0-9a-z]{9}-[0-9a-z]{4}-[0-9a-z]{8}$/)
    expect(entry?.device).toBe(entry?.hlc.split('-')[2])
    expect(entry?.operation).toEqual({ entity: 'movimiento', op: 'put', payload: m })
  })

  it('chains basedOn to the previous operation on the same entity id', async () => {
    const m = movimiento()
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: m })
    const [first] = await listPendingOperations()

    const edited = { ...m, monto: 2000 }
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: edited })
    const entries = await listPendingOperations()
    const second = entries.find((e) => e.hlc !== first?.hlc)

    expect(second?.basedOn).toBe(first?.hlc)
  })

  it("chains basedOn to a tip learned from a pull, not just this device's own outbox history", async () => {
    // A device that pulled a newer version it never queued locally must
    // still base its next op on it, or a later delete looks falsely
    // concurrent with an edit it saw.
    const m = movimiento()
    await recordKnownTip('movimiento', m.id, '000000005-0000-remotedev')

    await enqueueOperation({ entity: 'movimiento', op: 'del', payload: { id: m.id } })
    const [entry] = await listPendingOperations()

    expect(entry?.basedOn).toBe('000000005-0000-remotedev')
  })

  it("prefers this device's own more recent outbox history over a stale pulled tip", async () => {
    const m = movimiento()
    await recordKnownTip('movimiento', m.id, '000000001-0000-remotedev') // stale — from before this device's own edit below

    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: m })
    const [first] = await listPendingOperations()

    await enqueueOperation({ entity: 'movimiento', op: 'del', payload: { id: m.id } })
    const entries = await listPendingOperations()
    const second = entries.find((e) => e.hlc !== first?.hlc)

    expect(second?.basedOn).toBe(first?.hlc)
  })

  it('does not chain basedOn across different entity ids', async () => {
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })

    const entries = await listPendingOperations()
    expect(entries.every((e) => e.basedOn === null)).toBe(true)
  })

  it('a delete carries just the id, not the whole record', async () => {
    await enqueueOperation({ entity: 'movimiento', op: 'del', payload: { id: 'mov_1' } })

    const [entry] = await listPendingOperations()
    expect(entry?.operation).toEqual({ entity: 'movimiento', op: 'del', payload: { id: 'mov_1' } })
    expect(entry?.entityId).toBe('mov_1')
  })

  it('a config put uses a fixed entity id, since Config is a singleton', async () => {
    await enqueueOperation({ entity: 'config', op: 'put', payload: CONFIG_SEMILLA })

    const [entry] = await listPendingOperations()
    expect(entry?.entity).toBe('config')
    expect(entry?.entityId).toBe('config')
  })

  it('marks the store dirty after a successful enqueue', async () => {
    expect(useOutboxStore.getState().dirty).toBe(false)

    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })

    expect(useOutboxStore.getState().dirty).toBe(true)
  })

  it('reports success back to the caller', async () => {
    await expect(
      enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() }),
    ).resolves.toBe(true)
  })

  it('never throws on a storage failure — logs, drops the op, and reports it as unqueued', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi.spyOn(db.outbox, 'add').mockRejectedValue(new Error('IDB blocked'))

    await expect(
      enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() }),
    ).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(await listPendingOperations()).toEqual([])

    spy.mockRestore()
    warn.mockRestore()
  })
})

describe('listPendingOperations', () => {
  it('returns entries in hlc order (the total order replay needs)', async () => {
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })

    const entries = await listPendingOperations()
    const hlcs = entries.map((e) => e.hlc)
    expect(hlcs).toEqual(hlcs.toSorted())
  })

  it('degrades to an empty list on a storage read failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi.spyOn(db.outbox, 'orderBy').mockImplementation(() => {
      throw new Error('IDB blocked')
    })

    expect(await listPendingOperations()).toEqual([])
    expect(warn).toHaveBeenCalled()

    spy.mockRestore()
    warn.mockRestore()
  })
})

describe('removeOperations', () => {
  it('clears the given entries and drops dirty once the queue is empty', async () => {
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    const [entry] = await listPendingOperations()

    await removeOperations([entry!.id])

    expect(await listPendingOperations()).toEqual([])
    expect(useOutboxStore.getState().dirty).toBe(false)
  })

  it('stays dirty if operations remain after a partial removal', async () => {
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    const [first] = await listPendingOperations()

    await removeOperations([first!.id])

    expect(useOutboxStore.getState().dirty).toBe(true)
  })
})

describe('observeRemoteHlc / clampOutboxClockToServer', () => {
  it('a later local tick sorts after an observed remote hlc, even before this device has ticked itself', async () => {
    await observeRemoteHlc('000000005-0000-remotedev')

    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    const [entry] = await listPendingOperations()

    expect(entry!.hlc > '000000005-0000-remotedev').toBe(true)
  })

  it('clampOutboxClockToServer pulls a poisoned clock down so future ticks track real time again', async () => {
    // Mocking just Date.now (not vi.useFakeTimers, which also stalls the
    // real timers dexie's IndexedDB transactions schedule on) mirrors
    // hlc.test.ts's own clampToServer scenario: a wildly-ahead physical
    // reading poisons the clock, then the real clock corrects itself.
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(10_000_000_000_000)
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    const [poisoned] = await listPendingOperations()

    dateNow.mockReturnValue(1_000)
    await clampOutboxClockToServer(1_000)
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    // listPendingOperations() sorts by hlc, not insertion order — the
    // clamped (small) hlc now sorts *before* the poisoned one, so find it
    // by exclusion rather than assuming array position.
    const entries = await listPendingOperations()
    const clamped = entries.find((e) => e.hlc !== poisoned!.hlc)
    const decodedMillis = Number.parseInt(clamped!.hlc.split('-')[0] ?? '0', 36)

    expect(decodedMillis).toBe(1_000)
    dateNow.mockRestore()
  })
})

// A guest's pending operations must never queue into a signed-in account's
// outbox, or vice versa — the outbox must move with the active profile.
describe('setOutboxDatabase', () => {
  const otherDbName = 'kurobello-outbox-redirect-test'

  afterEach(async () => {
    const other = createProfileDb(otherDbName)
    await other.outbox.clear()
    await other.delete()
  })

  it('redirects enqueueOperation/listPendingOperations to the given profile database', async () => {
    const other = createProfileDb(otherDbName)
    setOutboxDatabase(other)

    const m = movimiento()
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: m })

    expect(await other.outbox.count()).toBe(1)
    expect(await db.outbox.count()).toBe(0)
    const pending = await listPendingOperations()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.entityId).toBe(m.id)
  })

  it('refreshes the dirty flag against the newly bound database, not the one it replaced', async () => {
    const other = createProfileDb(otherDbName)
    await other.outbox.add({
      id: crypto.randomUUID(),
      entity: 'movimiento',
      entityId: 'preexisting',
      hlc: '000000001-0000-dev',
      basedOn: null,
      device: 'dev',
      enqueuedAt: Date.now(),
      operation: { entity: 'movimiento', op: 'del', payload: { id: 'preexisting' } },
    })

    setOutboxDatabase(other)
    // refreshDirty() is fire-and-forget inside setOutboxDatabase — wait for
    // the store to reflect it rather than asserting synchronously.
    await vi.waitFor(() => expect(useOutboxStore.getState().dirty).toBe(true))
  })
})
