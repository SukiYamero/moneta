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
type GuestMarkerRow = { id: number }
type ActiveProfileRow = { id: number; profileId: string }
type AdoptionDeclinedRow = { id: number }
type AdoptionConsentRow = { id: number; profileId: string; accountKey?: string }
type LandscapeGateSkippedRow = { id: number }

beforeEach(async () => {
  const v11 = new Dexie('kurobello-device') as Dexie & {
    marker: EntityTable<MarkerRow, 'id'>
    driveDecision: EntityTable<DriveDecisionRow, 'id'>
    anchor: EntityTable<AnchorRow, 'id'>
    profiles: EntityTable<ProfileRow, 'id'>
    deviceId: EntityTable<DeviceIdRow, 'id'>
    syncTips: EntityTable<SyncTipRow, 'id'>
    syncFileCache: EntityTable<SyncFileCacheRow, 'id'>
    guestLock: EntityTable<GuestLockRow, 'id'>
    guestMarker: EntityTable<GuestMarkerRow, 'id'>
    activeProfile: EntityTable<ActiveProfileRow, 'id'>
    adoptionDeclined: EntityTable<AdoptionDeclinedRow, 'id'>
    adoptionConsent: EntityTable<AdoptionConsentRow, 'id'>
    landscapeGateSkipped: EntityTable<LandscapeGateSkippedRow, 'id'>
  }
  v11.version(1).stores({ marker: 'id' })
  v11.version(2).stores({ marker: 'id', driveDecision: 'id' })
  v11.version(3).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
  })
  v11.version(4).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
  })
  v11.version(5).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
  })
  v11.version(6).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
  })
  v11.version(7).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
    guestLock: 'id',
  })
  v11.version(8).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
    guestLock: 'id',
    guestMarker: 'id',
  })
  v11.version(9).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
    guestLock: 'id',
    guestMarker: 'id',
    activeProfile: 'id',
    adoptionDeclined: 'id',
  })
  v11.version(10).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
    guestLock: 'id',
    guestMarker: 'id',
    activeProfile: 'id',
    adoptionDeclined: 'id',
    adoptionConsent: 'id',
  })
  v11.version(11).stores({
    marker: 'id',
    driveDecision: 'id',
    anchor: 'id',
    profiles: 'id, kind, lastUsedAt',
    deviceId: 'id',
    syncTips: 'id',
    syncFileCache: 'id',
    guestLock: 'id',
    guestMarker: 'id',
    activeProfile: 'id',
    adoptionDeclined: 'id',
    adoptionConsent: 'id',
    landscapeGateSkipped: 'id',
  })
  await v11.open()
  await v11.marker.put({ id: 1, loggedInBefore: true })
  await v11.deviceId.put({ id: 1, value: 'olddevic' })
  await v11.landscapeGateSkipped.put({ id: 1 })
  v11.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v11 device with a stale landscape-gate dismissal upgrades to v12 without erroring', async () => {
  const { deviceDb, hasLoggedInBefore, getDeviceId } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDeviceId()).toBe('olddevic')
  expect(deviceDb.verno).toBeGreaterThanOrEqual(12)
})

test('the landscapeGateSkipped table is dropped on upgrade — the old dismissal no longer exists anywhere', async () => {
  const { deviceDb } = await import('@/lib/deviceStore')

  expect(deviceDb.tables.map((t) => t.name)).not.toContain('landscapeGateSkipped')
})
