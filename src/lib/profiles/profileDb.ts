import { createProfileDb, db, type ProfileDb } from '@/lib/db'
import { DEFAULT_PROFILE_DATABASE_NAME } from '@/lib/profiles/profileRegistry'

// One Dexie connection per database name, reused across calls — mirrors
// db.ts's own frozen module-level `db` singleton, generalized to N
// databases instead of one (specs.md §10.15). The default name resolves to
// that exact `db` instance rather than opening a second connection to the
// same IndexedDB database, so every existing caller of `db` (pinLock.ts,
// repo.local.ts's own default, every test that imports it) keeps sharing
// the one connection and its `ready()` memo.
const openDatabases = new Map<string, ProfileDb>([[DEFAULT_PROFILE_DATABASE_NAME, db]])

export const getProfileDatabase = (databaseName: string): ProfileDb => {
  const existing = openDatabases.get(databaseName)
  if (existing) return existing
  const created = createProfileDb(databaseName)
  openDatabases.set(databaseName, created)
  return created
}

// Test-only: drops a cached non-default connection so a test can open a
// fresh one under the same name again. Refuses to touch the default `db`
// entry — that connection is the frozen singleton, never test-reset here.
export const __clearProfileDatabaseCacheForTests = (databaseName: string): void => {
  if (databaseName === DEFAULT_PROFILE_DATABASE_NAME) return
  openDatabases.delete(databaseName)
}
