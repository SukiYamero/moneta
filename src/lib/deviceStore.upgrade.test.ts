import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

type MarkerRow = { id: number; loggedInBefore: boolean }

beforeEach(async () => {
  const v1 = new Dexie('kurobello-device') as Dexie & { marker: EntityTable<MarkerRow, 'id'> }
  v1.version(1).stores({ marker: 'id' })
  await v1.open()
  await v1.marker.put({ id: 1, loggedInBefore: true })
  v1.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v1 device upgrades to v2 without losing its login marker', async () => {
  const { getDriveDecision, hasLoggedInBefore } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDriveDecision()).toBeUndefined()
})
