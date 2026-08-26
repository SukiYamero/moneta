import { deviceDb } from '@/lib/deviceStore'

export type ProfileKind = 'local' | 'google'

export interface ProfileRecord {
  id: string
  label: string
  kind: ProfileKind
  databaseName: string
  createdAt: string
  lastUsedAt: string
  accountKey?: string
  driveFolderId?: string
  lastPushAt?: string
  lastPullAt?: string
}

const profileTable = deviceDb.profiles
const activeProfilePointer = deviceDb.activeProfile

export const DEFAULT_PROFILE_ID = 'kurobello' as const
export const DEFAULT_PROFILE_DATABASE_NAME = 'kurobello' as const

export const makeProfileDatabaseName = (profileId: string): string => `kurobello-${profileId}`

const ACTIVE_PROFILE_POINTER_ID = 1 as const

const nowIso = (): string => new Date().toISOString()

const bumpIso = (iso: string): string => new Date(new Date(iso).getTime() + 1).toISOString()

const nextLastUsedAt = (existing: ProfileRecord[]): string => {
  const maxExisting = existing.reduce((max, p) => (p.lastUsedAt > max ? p.lastUsedAt : max), '')
  const candidate = nowIso()
  return candidate > maxExisting ? candidate : bumpIso(maxExisting)
}

const defaultProfileRecord = (): ProfileRecord => {
  const timestamp = nowIso()
  return {
    id: DEFAULT_PROFILE_ID,
    label: 'Local',
    kind: 'local',
    databaseName: DEFAULT_PROFILE_DATABASE_NAME,
    createdAt: timestamp,
    lastUsedAt: timestamp,
  }
}

export const listProfiles = async (): Promise<ProfileRecord[]> => {
  try {
    return await profileTable.toArray()
  } catch (e) {
    console.warn('profiles: could not read the registry, treating as empty', e)
    return []
  }
}

export const getProfile = async (id: string): Promise<ProfileRecord | undefined> => {
  try {
    return await profileTable.get(id)
  } catch (e) {
    console.warn(`profiles: could not read profile "${id}"`, e)
    return undefined
  }
}

export interface RegisterProfileInput {
  id: string
  label: string
  kind: ProfileKind
  databaseName: string
  accountKey?: string
}

export const registerProfile = async (input: RegisterProfileInput): Promise<ProfileRecord> => {
  return deviceDb.transaction('rw', profileTable, async () => {
    const existing = await profileTable.toArray()
    const record: ProfileRecord = {
      ...input,
      createdAt: nowIso(),
      lastUsedAt: nextLastUsedAt(existing),
    }
    await profileTable.put(record)
    return record
  })
}

export const removeProfile = async (id: string): Promise<void> => {
  if (id === DEFAULT_PROFILE_ID) return
  try {
    await profileTable.delete(id)
    if ((await getActiveProfileId()) === id)
      await activeProfilePointer.delete(ACTIVE_PROFILE_POINTER_ID)
  } catch (e) {
    console.warn(`profiles: could not remove profile "${id}" from the registry`, e)
  }
}

export const touchLastUsed = async (id: string): Promise<void> => {
  try {
    await deviceDb.transaction('rw', profileTable, async () => {
      const existing = await profileTable.toArray()
      await profileTable.update(id, { lastUsedAt: nextLastUsedAt(existing) })
    })
  } catch (e) {
    console.warn(`profiles: could not update last-used for "${id}"`, e)
  }
}

export const setDriveFolderId = async (id: string, driveFolderId: string): Promise<void> => {
  await profileTable.update(id, { driveFolderId })
}

export const recordSuccessfulPush = async (id: string, at: string = nowIso()): Promise<void> => {
  await profileTable.update(id, { lastPushAt: at })
}

export const recordSuccessfulPull = async (id: string, at: string = nowIso()): Promise<void> => {
  await profileTable.update(id, { lastPullAt: at })
}

export interface ResolveGoogleProfileInput {
  accountKey: string
  label: string
}

export const resolveGoogleProfile = async (
  input: ResolveGoogleProfileInput,
): Promise<ProfileRecord> => {
  return deviceDb.transaction('rw', profileTable, async () => {
    const existing: ProfileRecord[] = await profileTable.toArray()
    const owned = existing.find((p) => p.kind === 'google' && p.accountKey === input.accountKey)
    if (owned) {
      const touched: ProfileRecord = { ...owned, lastUsedAt: nextLastUsedAt(existing) }
      await profileTable.put(touched)
      return touched
    }
    const id = crypto.randomUUID()
    const record: ProfileRecord = {
      id,
      label: input.label,
      kind: 'google',
      databaseName: makeProfileDatabaseName(id),
      createdAt: nowIso(),
      lastUsedAt: nextLastUsedAt(existing),
      accountKey: input.accountKey,
    }
    await profileTable.put(record)
    return record
  })
}

export const getActiveProfileId = async (): Promise<string | undefined> => {
  try {
    return (await activeProfilePointer.get(ACTIVE_PROFILE_POINTER_ID))?.profileId
  } catch (e) {
    console.warn('profiles: could not read the active-profile pointer, falling back to recency', e)
    return undefined
  }
}

export const setActiveProfileId = async (id: string): Promise<void> => {
  try {
    await activeProfilePointer.put({ id: ACTIVE_PROFILE_POINTER_ID, profileId: id })
  } catch (e) {
    console.warn('profiles: could not persist the active-profile pointer', e)
  }
}

export const getActiveProfile = async (): Promise<ProfileRecord> => {
  const existing = await listProfiles()
  if (existing.length === 0) {
    const record = defaultProfileRecord()
    try {
      await profileTable.put(record)
    } catch (e) {
      console.warn('profiles: could not persist the default profile record', e)
    }
    return record
  }
  const pointedId = await getActiveProfileId()
  const pointed = pointedId ? existing.find((p) => p.id === pointedId) : undefined
  if (pointed) return pointed
  return existing.reduce((latest, candidate) =>
    candidate.lastUsedAt > latest.lastUsedAt ? candidate : latest,
  )
}

export const __clearRegistryForTests = async (): Promise<void> => {
  await profileTable.clear()
  await activeProfilePointer.clear()
}
