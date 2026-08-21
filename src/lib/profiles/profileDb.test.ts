import { afterEach, expect, test } from 'vitest'
import { db } from '@/lib/db'
import { DEFAULT_PROFILE_DATABASE_NAME } from '@/lib/profiles/profileRegistry'
import { __clearProfileDatabaseCacheForTests, getProfileDatabase } from '@/lib/profiles/profileDb'

const TEST_DB_NAME = 'kurobello-profile-db-test'

afterEach(async () => {
  __clearProfileDatabaseCacheForTests(TEST_DB_NAME)
})

test('the default database name resolves to the frozen db instance, not a second connection', () => {
  expect(getProfileDatabase(DEFAULT_PROFILE_DATABASE_NAME)).toBe(db)
})

test('a non-default name opens a distinct, independently-schemad database', async () => {
  const database = getProfileDatabase(TEST_DB_NAME)
  try {
    expect(database).not.toBe(db)
    expect(database.name).toBe(TEST_DB_NAME)
    expect(database.tables.map((t) => t.name).toSorted()).toEqual(
      ['activos', 'config', 'movimientos', 'outbox', 'profileOwner', 'vault'].toSorted(),
    )
  } finally {
    database.close()
    await database.delete()
  }
})

test('calling getProfileDatabase twice with the same non-default name returns the same connection', async () => {
  const first = getProfileDatabase(TEST_DB_NAME)
  const second = getProfileDatabase(TEST_DB_NAME)
  try {
    expect(first).toBe(second)
  } finally {
    first.close()
    await first.delete()
  }
})
