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

  // 0 is a real, valid count, so a storage failure must not degrade to it —
  // that would be indistinguishable from "genuinely no local data" and
  // silently suppress the adoption offer on a device whose storage is broken.
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

  // Simulates the interruption by making the target write fail partway
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

// "yes" is consent for the whole move, not merely for whichever attempt was
// running when the tab closed — finishConsentedAdoption is the "do the move,
// then forget we owed it" pair shared by the user-initiated accept
// (authStore.ts) and the silent resume below.
describe('finishConsentedAdoption', () => {
  it('moves the movements and only then clears the consent marker', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento({ id: 'm1' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })

    const result = await finishConsentedAdoption(target)

    expect(result).toEqual({ movedCount: 1 })
    expect(await getAdoptionConsent()).toBeUndefined()
  })

  // The ordering matters: clearing the marker before the move is confirmed
  // would strand an interruption with no record that anything was ever
  // consented to, leaving the data half-moved and untraceable.
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

// Resuming an adoption already consented to is completion, not a new offer —
// it runs silently, on boot, with no prompt, driven only by whatever
// deviceStore.ts's adoptionConsent marker says is still owed.
describe('resumePendingAdoption', () => {
  it('does nothing when there is no pending consent', async () => {
    const target = await registerTarget()
    await db.movimientos.bulkPut([movimiento()])

    await resumePendingAdoption(target)

    expect(await db.movimientos.toArray()).toHaveLength(1) // untouched — nothing was ever consented to
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

  // The first "boot" hits the exact same interruption adoptGuestMovements's
  // own test simulates, and the second — with no special argument, driven
  // only by the still-present marker — finishes the job.
  it('finishes an adoption interrupted mid-move when resumed silently on a later boot, with no prompt', async () => {
    const target = await registerTarget()
    const targetDb = getProfileDatabase(TARGET_DB_NAME)
    await db.movimientos.bulkPut([movimiento({ id: 'm1' }), movimiento({ id: 'm2' })])
    await setAdoptionConsent({ profileId: target.id, accountKey: target.accountKey })

    const addSpy = vi.spyOn(targetDb.outbox, 'add').mockRejectedValueOnce(new Error('tab closed'))

    // First "boot" after the interruption: resumePendingAdoption never
    // throws (it's a silent background task, not a user-facing action) —
    // but the underlying move genuinely fails, and neither side loses data.
    await expect(resumePendingAdoption(target)).resolves.toBeUndefined()
    expect((await db.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect(await getAdoptionConsent()).toBeDefined() // still pending — not cleared on failure

    addSpy.mockRestore()

    // Second "boot": same consent, no new prompt, no special argument.
    await resumePendingAdoption(target)

    expect(await db.movimientos.toArray()).toEqual([])
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect(await getAdoptionConsent()).toBeUndefined()
  })

  // The consent boundary itself: "yes" was given for *this* account. If the
  // person signs into a different one before the resume runs, moving the
  // data there would spend consent that was never given for it.
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

    expect(await db.movimientos.toArray()).toHaveLength(1) // untouched
    const otherDb = getProfileDatabase(OTHER_DB_NAME)
    expect(await otherDb.movimientos.toArray()).toEqual([]) // nothing moved into the wrong account
    expect(await getAdoptionConsent()).toEqual({
      id: 1,
      profileId: consented.id,
      accountKey: consented.accountKey,
    }) // left in place — still resumable once the right profile is active again

    __clearProfileDatabaseCacheForTests(OTHER_DB_NAME)
  })

  // Both fields name the target, not merely one — a matching id with a
  // mismatched account key must be rejected exactly like a different profile.
  it('does not move data when the profile id matches but the account key does not', async () => {
    const target = await registerTarget() // accountKey undefined
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
