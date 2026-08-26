import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecisionRow = { id: number; decision: 'connected' | 'dismissed' }
type AnchorRow = { id: number; lastOnlineAt: number }
type ProfileRow = { id: string; kind: 'local' | 'google'; lastUsedAt: string }
type DeviceIdRow = { id: number; value: string }
type SyncTipRow = { id: string; hlc: string }
type SyncFileCacheRow = { id: string; modifiedTime: string; file: unknown; skipped: number }
type GuestLockRow = { id: number; credentialId: Uint8Array; lastActiveAt: number }

beforeEach(async () => {
  const v7 = new Dexie('kurobello-device') as Dexie & {
    marker: EntityTable<MarkerRow, 'id'>
    driveDecision: EntityTable<DriveDecisionRow, 'id'>
    anchor: EntityTable<AnchorRow, 'id'>
    profiles: EntityTable<ProfileRow, 'id'>
    deviceId: EntityTable<DeviceIdRow, 'id'>
    syncTips: EntityTable<SyncTipRow, 'id'>
    syncFileCache: EntityTable<SyncFileCacheRow, 'id'>
    guestLock: EntityTable<GuestLockRow, 'id'>
  }
  v7.version(1).stores({ marker: 'id' })
  v7.version(2).stores({ marker: 'id', driveDecision: 'id' })
  v7.version(3).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
  })
  v7.version(4).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
  })
  v7.version(5).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
  })
  v7.version(6).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
  })
  v7.version(7).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
    guestLock: 'id',
  })
  await v7.open()
  await v7.marker.put({ id: 1, loggedInBefore: true })
  await v7.deviceId.put({ id: 1, value: 'olddevic' })
  await v7.guestLock.put({ id: 1, credentialId: new Uint8Array([1, 2]), lastActiveAt: 1000 })
  v7.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v7 device upgrades to v8 without losing its marker, device id, or guest lock', async () => {
  const { deviceDb, hasLoggedInBefore, getDeviceId, getGuestLock } =
    await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDeviceId()).toBe('olddevic')
  expect((await getGuestLock())?.lastActiveAt).toBe(1000)
  expect(deviceDb.guestMarker).toBeDefined()
})

test('hasUsedGuestBefore answers false for a device that never used guest mode, rather than erroring', async () => {
  const { hasUsedGuestBefore } = await import('@/lib/deviceStore')

  await expect(hasUsedGuestBefore()).resolves.toBe(false)
})
