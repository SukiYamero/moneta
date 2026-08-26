import { createProfileDb, db, type ProfileDb } from '@/lib/db'
import { DEFAULT_PROFILE_DATABASE_NAME } from '@/lib/profiles/profileRegistry'

const openDatabases = new Map<string, ProfileDb>([[DEFAULT_PROFILE_DATABASE_NAME, db]])

export const getProfileDatabase = (databaseName: string): ProfileDb => {
  const existing = openDatabases.get(databaseName)
  if (existing) return existing
  const created = createProfileDb(databaseName)
  openDatabases.set(databaseName, created)
  return created
}

export const __clearProfileDatabaseCacheForTests = (databaseName: string): void => {
  if (databaseName === DEFAULT_PROFILE_DATABASE_NAME) return
  openDatabases.delete(databaseName)
}
