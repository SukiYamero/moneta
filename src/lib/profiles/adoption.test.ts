import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import type { Movimiento } from '@/lib/schema'
import {
  __clearProfileDatabaseCacheForTests,
  __clearRegistryForTests,
  getProfileDatabase,
  registerProfile,
} from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import { adoptGuestMovements, countGuestMovements } from '@/lib/profiles/adoption'

const TARGET_DB_NAME = 'kurobello-adoption-test'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-01',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const registerTarget = async (): Promise<ProfileRecord> => {
  const record = await registerProfile({
    id: 'adopt-target',
    label: 'Ana',
    kind: 'google',
    databaseName: TARGET_DB_NAME,
  })
  return record
}

afterEach(async () => {
  await db.movimientos.clear()
  await db.outbox.clear()
  const targetDb = getProfileDatabase(TARGET_DB_NAME)
  await targetDb.movimientos.clear()
  await targetDb.outbox.clear()
  __clearProfileDatabaseCacheForTests(TARGET_DB_NAME)
  await __clearRegistryForTests()
})

describe('countGuestMovements', () => {
  it('is 0 on a device with no local guest data — the common first-sign-in case', async () => {
    expect(await countGuestMovements()).toBe(0)
  })

  it('counts the local/guest profile’s movements', async () => {
    await db.movimientos.bulkPut([movimiento(), movimiento(), movimiento()])
    expect(await countGuestMovements()).toBe(3)
  })

  // docs/error-handling.md §4: 0 is a real, valid count, so a storage
  // failure must not degrade to it — that would be indistinguishable from
  // "genuinely no local data" and silently suppress the adoption offer on
  // a device whose storage is actually broken. `authStore.ts`'s
  // `checkGuestAdoption` is the one place that decides how to degrade this
  // (its own test covers that); this module must let the failure through.
  it('propagates a storage failure rather than degrading to 0', async () => {
    const spy = vi.spyOn(db.movimientos, 'count').mockRejectedValue(new Error('IDB blocked'))

    await expect(countGuestMovements()).rejects.toThrow('IDB blocked')

    spy.mockRestore()
  })
})

describe('adoptGuestMovements', () => {
  it('does nothing and reports 0 moved when there is nothing local to bring', async () => {
    const target = await registerTarget()
    const result = await adoptGuestMovements(target)
    expect(result).toEqual({ movedCount: 0 })
  })

  it('moves every local movement into the target profile’s own database, and enqueues it for Drive', async () => {
    const target = await registerTarget()
    const a = movimiento({ id: 'mA' })
    const b = movimiento({ id: 'mB' })
    await db.movimientos.bulkPut([a, b])

    const result = await adoptGuestMovements(target)

    expect(result).toEqual({ movedCount: 2 })
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['mA', 'mB'].toSorted(),
    )
    const queued = await targetDb.outbox.toArray()
    expect(queued.map((e) => e.entityId).toSorted()).toEqual(['mA', 'mB'].toSorted())
    expect(queued.every((e) => e.operation.op === 'put')).toBe(true)
  })

  // specs.md §10.32: "the emptied guest profile stays... it simply has no
  // movements left."
  it('empties the local/guest profile once its movements have been moved', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento()])

    await adoptGuestMovements(target)

    expect(await db.movimientos.toArray()).toEqual([])
  })

  // specs.md §10.32 edge case: "the account already has data in Drive...
  // adoption is a merge, not a replace... both months end up present. This
  // must be true rather than assumed — it gets a test."
  it('merges with data the target profile already has, rather than replacing it', async () => {
    const target = await registerTarget()
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    const alreadyThere = movimiento({ id: 'existing', fecha: '2026-01-01' })
    await targetDb.movimientos.put(alreadyThere)
    const guestOne = movimiento({ id: 'guest-1' })
    await db.movimientos.put(guestOne)

    const result = await adoptGuestMovements(target)

    expect(result).toEqual({ movedCount: 1 })
    const finalIds = (await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()
    expect(finalIds).toEqual(['existing', 'guest-1'].toSorted())
  })

  // specs.md §10.32: "adoption interrupted (a tab closed mid-move)... must
  // be resumable or atomic, never half-moved." Written test-first: this
  // simulates the interruption by making the target write fail partway
  // through, then verifies the state is safe to resume from, then resumes.
  it('is resumable after an interruption: a partial failure never half-moves data, and calling it again finishes the job', async () => {
    const target = await registerTarget()
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    await db.movimientos.bulkPut([movimiento({ id: 'm1' }), movimiento({ id: 'm2' })])

    const addSpy = vi.spyOn(targetDb.outbox, 'add').mockRejectedValueOnce(new Error('tab closed'))

    await expect(adoptGuestMovements(target)).rejects.toThrow()

    // Interrupted mid-way: the target write (bulkPut) already landed —
    // that part is idempotent and safe regardless of when it runs — but
    // the source must still hold everything, since nothing has been
    // confirmed moved yet. Never half-moved: neither side is missing data.
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect((await db.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )

    addSpy.mockRestore()

    // Resume: calling it again, with no special "resume" argument, finishes
    // the job — recomputing from scratch is what makes this safe to retry
    // blindly, from any interruption point.
    const result = await adoptGuestMovements(target)
    expect(result).toEqual({ movedCount: 2 })
    expect(await db.movimientos.toArray()).toEqual([])
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    // No duplicate outbox entries from the interrupted first attempt plus
    // the successful retry — the "already queued" guard is what prevents
    // uploading (and paying for) the same shard entry twice.
    const finalQueue = await targetDb.outbox.toArray()
    expect(finalQueue.map((e) => e.entityId).toSorted()).toEqual(['m1', 'm2'].toSorted())
  })

  it('is a safe no-op when called again after a completed adoption', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento()])
    await adoptGuestMovements(target)

    const result = await adoptGuestMovements(target)

    expect(result).toEqual({ movedCount: 0 })
  })
})
