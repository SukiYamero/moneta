import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { db } from '@/lib/db'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import {
  __resetOutboxClockForTests,
  enqueueOperation,
  listPendingOperations,
  removeOperations,
  useOutboxStore,
} from '@/lib/outbox'

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
  __resetDeviceIdForTests()
  __resetOutboxClockForTests()
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
  it('returns entries in hlc order (the total order §10.19 replay needs)', async () => {
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
