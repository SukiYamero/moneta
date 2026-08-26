import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecisionRow = { id: number; decision: 'connected' | 'dismissed' }
type AnchorRow = { id: number; lastOnlineAt: number }
type ProfileRow = { id: string; kind: 'local' | 'google'; lastUsedAt: string }
type DeviceIdRow = { id: number; value: string }

beforeEach(async () => {
  const v4 = new Dexie('kurobello-device') as Dexie & {
    marker: EntityTable<MarkerRow, 'id'>
    driveDecision: EntityTable<DriveDecisionRow, 'id'>
    anchor: EntityTable<AnchorRow, 'id'>
    profiles: EntityTable<ProfileRow, 'id'>
    deviceId: EntityTable<DeviceIdRow, 'id'>
  }
  v4.version(1).stores({ marker: 'id' })
  v4.version(2).stores({ marker: 'id', driveDecision: 'id' })
  v4.version(3).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
  })
  v4.version(4).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
  })
  await v4.open()
  await v4.marker.put({ id: 1, loggedInBefore: true })
  await v4.deviceId.put({ id: 1, value: 'olddevic' })
  v4.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v4 device upgrades to v5 without losing its marker or device id', async () => {
  const { deviceDb, hasLoggedInBefore, getDeviceId } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDeviceId()).toBe('olddevic')
  expect(deviceDb.syncTips).toBeDefined()
})

test('getKnownTip answers null for a device that never recorded a tip, rather than erroring', async () => {
  const { getKnownTip } = await import('@/lib/sync/tip')

  await expect(getKnownTip('movimiento', 'm1')).resolves.toBeNull()
})
