import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecisionRow = { id: number; decision: 'connected' | 'dismissed' }
type AnchorRow = { id: number; lastOnlineAt: number }
type ProfileRow = { id: string; kind: 'local' | 'google'; lastUsedAt: string }

beforeEach(async () => {
  const v3 = new Dexie('kurobello-device') as Dexie & {
    marker: EntityTable<MarkerRow, 'id'>
    driveDecision: EntityTable<DriveDecisionRow, 'id'>
    anchor: EntityTable<AnchorRow, 'id'>
    profiles: EntityTable<ProfileRow, 'id'>
  }
  v3.version(1).stores({ marker: 'id' })
  v3.version(2).stores({ marker: 'id', driveDecision: 'id' })
  v3.version(3).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
  })
  await v3.open()
  await v3.marker.put({ id: 1, loggedInBefore: true })
  await v3.anchor.put({ id: 1, lastOnlineAt: 42 })
  v3.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v3 device upgrades to v4 without losing its marker or anchor', async () => {
  const { deviceDb, hasLoggedInBefore } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await deviceDb.anchor.get(1)).toEqual({ id: 1, lastOnlineAt: 42 })
})

test('getDeviceId mints and persists a fresh id for a device that never had one', async () => {
  const { deviceDb, getDeviceId } = await import('@/lib/deviceStore')

  const id = await getDeviceId()

  expect(id).toMatch(/^[0-9a-z]{8}$/)
  expect(await deviceDb.deviceId.get(1)).toEqual({ id: 1, value: id })
})
