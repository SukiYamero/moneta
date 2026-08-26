import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecisionRow = { id: number; decision: 'connected' | 'dismissed' }
type AnchorRow = { id: number; lastOnlineAt: number }
type ProfileRow = { id: string; kind: 'local' | 'google'; lastUsedAt: string }
type DeviceIdRow = { id: number; value: string }
type SyncTipRow = { id: string; hlc: string }
type SyncFileCacheRow = { id: string; modifiedTime: string; file: unknown; skipped: number }

beforeEach(async () => {
  const v6 = new Dexie('kurobello-device') as Dexie & {
    marker: EntityTable<MarkerRow, 'id'>
    driveDecision: EntityTable<DriveDecisionRow, 'id'>
    anchor: EntityTable<AnchorRow, 'id'>
    profiles: EntityTable<ProfileRow, 'id'>
    deviceId: EntityTable<DeviceIdRow, 'id'>
    syncTips: EntityTable<SyncTipRow, 'id'>
    syncFileCache: EntityTable<SyncFileCacheRow, 'id'>
  }
  v6.version(1).stores({ marker: 'id' })
  v6.version(2).stores({ marker: 'id', driveDecision: 'id' })
  v6.version(3).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
  })
  v6.version(4).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
  })
  v6.version(5).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
  })
  v6.version(6).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
  })
  await v6.open()
  await v6.marker.put({ id: 1, loggedInBefore: true })
  await v6.deviceId.put({ id: 1, value: 'olddevic' })
  v6.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v6 device upgrades to v7 without losing its marker or device id', async () => {
  const { deviceDb, hasLoggedInBefore, getDeviceId } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDeviceId()).toBe('olddevic')
  expect(deviceDb.guestLock).toBeDefined()
})

test('getGuestLock answers undefined for a device that never enrolled, rather than erroring', async () => {
  const { getGuestLock } = await import('@/lib/deviceStore')

  await expect(getGuestLock()).resolves.toBeUndefined()
})
