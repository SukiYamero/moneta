import Dexie, { type EntityTable } from 'dexie'

type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecision = 'connected' | 'dismissed'
type DriveDecisionRow = { id: number; decision: DriveDecision }
export type AnchorRow = { id: number; lastOnlineAt: number }
export type ProfileRow = {
  id: string
  label: string
  kind: 'local' | 'google'
  databaseName: string
  createdAt: string
  lastUsedAt: string
  accountKey?: string
  driveFolderId?: string
  lastPushAt?: string
  lastPullAt?: string
}
export type DeviceIdRow = { id: number; value: string }
export type SyncTipRow = { id: string; hlc: string }
export type SyncFileCacheRow = { id: string; modifiedTime: string; file: unknown; skipped: number }
export type GuestLockRow = { id: number; credentialId: Uint8Array; lastActiveAt: number }
export type GuestMarkerRow = { id: number }
export type ActiveProfileRow = { id: number; profileId: string }
export type AdoptionDeclinedRow = { id: number }
export type AdoptionConsentRow = { id: number; profileId: string; accountKey?: string }
export type AdoptedMovementRow = { id: string }

const MARKER_ID = 1 as const
const GUEST_MARKER_ID = 1 as const
const DRIVE_DECISION_ID = 1 as const
const ADOPTION_DECLINED_ID = 1 as const
const ADOPTION_CONSENT_ID = 1 as const
const DEVICE_ID_ROW = 1 as const
const DEVICE_ID_LENGTH = 8
const DEVICE_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export const deviceDb = new Dexie('kurobello-device') as Dexie & {
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
  adoptedMovements: EntityTable<AdoptedMovementRow, 'id'>
}
deviceDb.version(1).stores({ marker: 'id' })
deviceDb.version(2).stores({ marker: 'id', driveDecision: 'id' })
deviceDb.version(3).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
})
deviceDb.version(4).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
})
deviceDb.version(5).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
})
deviceDb.version(6).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
  syncFileCache: 'id',
})
deviceDb.version(7).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
  syncFileCache: 'id',
  guestLock: 'id',
})
deviceDb.version(8).stores({
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
deviceDb.version(9).stores({
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
deviceDb.version(10).stores({
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
deviceDb.version(11).stores({
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
deviceDb.version(12).stores({
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
  landscapeGateSkipped: null,
})
deviceDb.version(13).stores({
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
  adoptedMovements: 'id',
})

export const hasLoggedInBefore = async (): Promise<boolean> => {
  try {
    return (await deviceDb.marker.get(MARKER_ID))?.loggedInBefore ?? false
  } catch (e) {
    console.warn('device: could not read the login marker, treating as first visit', e)
    return false
  }
}

export const markLoggedIn = async (): Promise<void> => {
  try {
    await deviceDb.marker.put({ id: MARKER_ID, loggedInBefore: true })
  } catch (e) {
    console.warn('device: could not persist the login marker', e)
  }
}

export const clearLoggedIn = async (): Promise<void> => {
  try {
    await deviceDb.marker.delete(MARKER_ID)
  } catch (e) {
    console.warn('device: could not clear the login marker', e)
  }
}

export const hasUsedGuestBefore = async (): Promise<boolean> => {
  try {
    return (await deviceDb.guestMarker.get(GUEST_MARKER_ID)) !== undefined
  } catch (e) {
    console.warn('device: could not read the guest marker, treating as never used', e)
    return false
  }
}

export const markGuestUsed = async (): Promise<void> => {
  try {
    await deviceDb.guestMarker.put({ id: GUEST_MARKER_ID })
  } catch (e) {
    console.warn('device: could not persist the guest marker', e)
  }
}

export const clearGuestUsed = async (): Promise<void> => {
  try {
    await deviceDb.guestMarker.delete(GUEST_MARKER_ID)
  } catch (e) {
    console.warn('device: could not clear the guest marker', e)
  }
}

export const hasDeclinedAdoption = async (): Promise<boolean> => {
  try {
    return (await deviceDb.adoptionDeclined.get(ADOPTION_DECLINED_ID)) !== undefined
  } catch (e) {
    console.warn('device: could not read the adoption decision, treating as never declined', e)
    return false
  }
}

export const markAdoptionDeclined = async (): Promise<void> => {
  try {
    await deviceDb.adoptionDeclined.put({ id: ADOPTION_DECLINED_ID })
  } catch (e) {
    console.warn('device: could not persist the adoption decision', e)
  }
}

export const getAdoptionConsent = async (): Promise<AdoptionConsentRow | undefined> => {
  try {
    return await deviceDb.adoptionConsent.get(ADOPTION_CONSENT_ID)
  } catch (e) {
    console.warn('device: could not read the adoption consent, treating as none pending', e)
    return undefined
  }
}

export const setAdoptionConsent = async (target: Omit<AdoptionConsentRow, 'id'>): Promise<void> => {
  try {
    await deviceDb.adoptionConsent.put({ id: ADOPTION_CONSENT_ID, ...target })
  } catch (e) {
    console.warn('device: could not persist the adoption consent', e)
  }
}

export const clearAdoptionConsent = async (): Promise<void> => {
  try {
    await deviceDb.adoptionConsent.delete(ADOPTION_CONSENT_ID)
  } catch (e) {
    console.warn('device: could not clear the adoption consent', e)
  }
}

const adoptedMovementKey = (profileId: string, movimientoId: string): string =>
  `${profileId}:${movimientoId}`

export const getAdoptedMovementIds = async (
  profileId: string,
  movimientoIds: string[],
): Promise<Set<string>> => {
  if (movimientoIds.length === 0) return new Set()
  try {
    const rows = await deviceDb.adoptedMovements.bulkGet(
      movimientoIds.map((id) => adoptedMovementKey(profileId, id)),
    )
    return new Set(movimientoIds.filter((_, i) => rows[i] !== undefined))
  } catch (e) {
    console.warn('device: could not read adopted-movement markers, treating as none adopted', e)
    return new Set()
  }
}

export const markMovementAdopted = async (profileId: string, movimientoId: string): Promise<void> => {
  try {
    await deviceDb.adoptedMovements.put({ id: adoptedMovementKey(profileId, movimientoId) })
  } catch (e) {
    console.warn('device: could not persist the adopted-movement marker', e)
  }
}

export const getDriveDecision = async (): Promise<DriveDecision | undefined> => {
  try {
    return (await deviceDb.driveDecision.get(DRIVE_DECISION_ID))?.decision
  } catch (e) {
    console.warn('device: could not read the Drive decision, treating as unanswered', e)
    return undefined
  }
}

export const setDriveDecision = async (decision: DriveDecision): Promise<void> => {
  try {
    await deviceDb.driveDecision.put({ id: DRIVE_DECISION_ID, decision })
  } catch (e) {
    console.warn('device: could not persist the Drive decision', e)
  }
}

export const clearDriveDecision = async (): Promise<void> => {
  try {
    await deviceDb.driveDecision.delete(DRIVE_DECISION_ID)
  } catch (e) {
    console.warn('device: could not clear the Drive decision', e)
  }
}

const generateDeviceId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(DEVICE_ID_LENGTH))
  return Array.from(bytes, (b) => DEVICE_ID_ALPHABET[b % DEVICE_ID_ALPHABET.length]).join('')
}

const resolveDeviceId = async (): Promise<string> => {
  try {
    const existing = await deviceDb.deviceId.get(DEVICE_ID_ROW)
    if (existing) return existing.value
  } catch (e) {
    console.warn('device: could not read the device id, minting a fresh one', e)
  }
  const value = generateDeviceId()
  try {
    await deviceDb.deviceId.put({ id: DEVICE_ID_ROW, value })
  } catch (e) {
    console.warn('device: could not persist the device id, using an ephemeral one this session', e)
  }
  return value
}

let deviceIdPromise: Promise<string> | null = null

export const getDeviceId = (): Promise<string> => {
  deviceIdPromise ??= resolveDeviceId()
  return deviceIdPromise
}

export const __resetDeviceIdForTests = (): void => {
  deviceIdPromise = null
}

export const GUEST_LOCK_ID = 1 as const

export const getGuestLock = async (): Promise<GuestLockRow | undefined> => {
  try {
    return await deviceDb.guestLock.get(GUEST_LOCK_ID)
  } catch (e) {
    console.warn('device: could not read the guest lock, treating as not enrolled', e)
    return undefined
  }
}

export const setGuestLock = async (row: Omit<GuestLockRow, 'id'>): Promise<void> => {
  try {
    await deviceDb.guestLock.put({ id: GUEST_LOCK_ID, ...row })
  } catch (e) {
    console.warn('device: could not persist the guest lock', e)
  }
}

export const clearGuestLock = async (): Promise<void> => {
  try {
    await deviceDb.guestLock.delete(GUEST_LOCK_ID)
  } catch (e) {
    console.warn('device: could not clear the guest lock', e)
  }
}

export const touchGuestLockActive = async (now: number = Date.now()): Promise<void> => {
  try {
    await deviceDb.guestLock.update(GUEST_LOCK_ID, { lastActiveAt: now })
  } catch (e) {
    console.warn('device: could not record the guest lock last-active time', e)
  }
}
