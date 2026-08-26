import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

// Deliberately does NOT statically import '@/lib/deviceStore', for the same
// reason deviceStore.upgrade.test.ts doesn't: importing it opens the real
// `kurobello-device` connection and upgrades it to v3 as a side effect,
// which would make it impossible to seed a v2-only database first.
//
// v3 folds `anchor` and `profiles` into this database. Neither table had
// ever shipped elsewhere, so there is no data to carry over, but a v2
// device (marker + driveDecision only) must still upgrade to v3 without
// losing either of its own two tables.
type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecisionRow = { id: number; decision: 'connected' | 'dismissed' }

beforeEach(async () => {
  const v2 = new Dexie('kurobello-device') as Dexie & {
    marker: EntityTable<MarkerRow, 'id'>
    driveDecision: EntityTable<DriveDecisionRow, 'id'>
  }
  v2.version(1).stores({ marker: 'id' })
  v2.version(2).stores({ marker: 'id', driveDecision: 'id' })
  await v2.open()
  await v2.marker.put({ id: 1, loggedInBefore: true })
  await v2.driveDecision.put({ id: 1, decision: 'dismissed' })
  v2.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v2 device upgrades to v3 without losing its marker or Drive decision', async () => {
  const { deviceDb, getDriveDecision, hasLoggedInBefore } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDriveDecision()).toBe('dismissed')
  // A device that never wrote a network anchor or a profile row resolves to
  // "no signal" — the same fail-open posture every other read here has, not
  // a crash from the new tables simply not existing yet on this device.
  expect(await deviceDb.anchor.get(1)).toBeUndefined()
  expect(await deviceDb.profiles.toArray()).toEqual([])
})
