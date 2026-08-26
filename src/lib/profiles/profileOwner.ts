import type { ProfileDb, ProfileOwnerRow } from '@/lib/db'

const OWNER_ROW_ID = 1 as const

export const ensureOwnerMarker = async (
  database: ProfileDb,
  marker: Omit<ProfileOwnerRow, 'id'>,
): Promise<void> => {
  try {
    const existing = await database.profileOwner.get(OWNER_ROW_ID)
    if (existing) return
    await database.profileOwner.put({ id: OWNER_ROW_ID, ...marker })
  } catch (e) {
    console.warn('profiles: could not write the owner marker', e)
  }
}

export const readOwnerMarker = async (
  database: ProfileDb,
): Promise<ProfileOwnerRow | undefined> => {
  return await database.profileOwner.get(OWNER_ROW_ID)
}
