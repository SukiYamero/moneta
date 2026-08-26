import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

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
  expect(await deviceDb.anchor.get(1)).toBeUndefined()
  expect(await deviceDb.profiles.toArray()).toEqual([])
})
