import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import type { Movimiento } from '@/lib/schema'
import { clearAdoptionConsent, getAdoptionConsent, setAdoptionConsent } from '@/lib/deviceStore'
import {
  __clearProfileDatabaseCacheForTests,
  __clearRegistryForTests,
  getProfileDatabase,
  registerProfile,
} from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import {
  adoptGuestMovements,
  countGuestMovements,
  finishConsentedAdoption,
  resumePendingAdoption,
} from '@/lib/profiles/adoption'

const TARGET_DB_NAME = 'kurobello-adoption-test'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-01',
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
  await clearAdoptionConsent()
})

describe('countGuestMovements', () => {
  it('is 0 on a device with no local guest data — the common first-sign-in case', async () => {
    expect(await countGuestMovements()).toBe(0)
  })

  it('counts the local/guest profile’s movements', async () => {
    await db.movimientos.bulkPut([movimiento(), movimiento(), movimiento()])
    expect(await countGuestMovements()).toBe(3)
  })

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

  it('empties the local/guest profile once its movements have been moved', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento()])

    await adoptGuestMovements(target)

    expect(await db.movimientos.toArray()).toEqual([])
  })

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

  it('is resumable after an interruption: a partial failure never half-moves data, and calling it again finishes the job', async () => {
    const target = await registerTarget()
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    await db.movimientos.bulkPut([movimiento({ id: 'm1' }), movimiento({ id: 'm2' })])

    const addSpy = vi.spyOn(targetDb.outbox, 'add').mockRejectedValueOnce(new Error('tab closed'))

    await expect(adoptGuestMovements(target)).rejects.toThrow()

    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect((await db.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )

    addSpy.mockRestore()

    const result = await adoptGuestMovements(target)
    expect(result).toEqual({ movedCount: 2 })
    expect(await db.movimientos.toArray()).toEqual([])
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
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

describe('finishConsentedAdoption', () => {
  it('moves the movements and only then clears the consent marker', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })

    const result = await finishConsentedAdoption(target)

    expect(result).toEqual({ movedCount: 1 })
    expect(await getAdoptionConsent()).toBeUndefined()
  })

  it('leaves the consent marker in place when the move itself fails', async () => {
    const target = await registerTarget()
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })
    const addSpy = vi.spyOn(targetDb.outbox, 'add').mockRejectedValueOnce(new Error('tab closed'))

    await expect(finishConsentedAdoption(target)).rejects.toThrow()

    expect(await getAdoptionConsent()).toEqual({
      id: 1,
      profileId: target.id,
      accountKey: target.accountKey,
    })

    addSpy.mockRestore()
  })
})

describe('resumePendingAdoption', () => {
  it('does nothing when there is no pending consent', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento()])

    await resumePendingAdoption(target)

    expect(await db.movimientos.toArray()).toHaveLength(1)
  })

  it('moves the data and clears the consent marker on an uninterrupted resume', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })

    await resumePendingAdoption(target)

    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    expect((await targetDb.movimientos.toArray()).map((m) => m.id)).toEqual(['m1'])
    expect(await db.movimientos.toArray()).toEqual([])
    expect(await getAdoptionConsent()).toBeUndefined()
  })

  it('finishes an adoption interrupted mid-move when resumed silently on a later boot, with no prompt', async () => {
    const target = await registerTarget()
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    await db.movimientos.bulkPut([movimiento({ id: 'm1' }), movimiento({ id: 'm2' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })

    const addSpy = vi.spyOn(targetDb.outbox, 'add').mockRejectedValueOnce(new Error('tab closed'))

    await expect(resumePendingAdoption(target)).resolves.toBeUndefined()
    expect((await db.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect(await getAdoptionConsent()).toBeDefined()

    addSpy.mockRestore()

    await resumePendingAdoption(target)

    expect(await db.movimientos.toArray()).toEqual([])
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect(await getAdoptionConsent()).toBeUndefined()
  })

  it('does not move data when the recorded consent names a different profile than the one now active', async () => {
    const consented = await registerProfile({
      id: 'adopt-target',
      label: 'Ana',
      kind: 'google',
      databaseName: TARGET_DB_NAME,
      accountKey: 'ana@example.com',
    })
    const OTHER_DB_NAME = 'kurobello-adoption-other'
    const other = await registerProfile({
      id: 'adopt-other',
      label: 'Beto',
      kind: 'google',
      databaseName: OTHER_DB_NAME,
      accountKey: 'beto@example.com',
    })
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: consented.id, accountKey: consented.accountKey })

    await resumePendingAdoption(other)

    expect(await db.movimientos.toArray()).toHaveLength(1)
    const otherDb = getProfileDatabase(OTHER_DB_NAME)
    expect(await otherDb.movimientos.toArray()).toEqual([])
    expect(await getAdoptionConsent()).toEqual({
      id: 1,
      profileId: consented.id,
      accountKey: consented.accountKey,
    })

    __clearProfileDatabaseCacheForTests(OTHER_DB_NAME)
  })

  it('does not move data when the profile id matches but the account key does not', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: 'ana@example.com' })

    await resumePendingAdoption(target)

    expect(await db.movimientos.toArray()).toHaveLength(1)
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    expect(await targetDb.movimientos.toArray()).toEqual([])
  })

  it('does nothing when there is no active profile to compare against', async () => {
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: 'adopt-target', accountKey: 'ana@example.com' })

    await resumePendingAdoption(null)

    expect(await db.movimientos.toArray()).toHaveLength(1)
  })
})
