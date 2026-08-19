import { afterEach, expect, test, vi } from 'vitest'
import {
  __clearRegistryForTests,
  DEFAULT_PROFILE_DATABASE_NAME,
  DEFAULT_PROFILE_ID,
  getActiveProfile,
  getProfile,
  listProfiles,
  makeProfileDatabaseName,
  profileRegistryDb,
  registerProfile,
  touchLastUsed,
} from '@/lib/profiles/profileRegistry'

afterEach(async () => {
  await __clearRegistryForTests()
})

test('a fresh device has no profiles registered', async () => {
  expect(await listProfiles()).toEqual([])
  expect(await getProfile(DEFAULT_PROFILE_ID)).toBeUndefined()
})

test('getActiveProfile on a fresh device adopts the frozen kurobello database as the first profile', async () => {
  const active = await getActiveProfile()
  expect(active.id).toBe(DEFAULT_PROFILE_ID)
  expect(active.databaseName).toBe(DEFAULT_PROFILE_DATABASE_NAME)
  expect(active.kind).toBe('local')
})

test('getActiveProfile persists the adopted default so a second read sees the same row', async () => {
  const first = await getActiveProfile()
  const stored = await getProfile(DEFAULT_PROFILE_ID)
  expect(stored).toEqual(first)
})

test('registerProfile adds a new profile with its own database name', async () => {
  const record = await registerProfile({
    id: 'p2',
    label: 'Cuenta de Google',
    kind: 'google',
    databaseName: makeProfileDatabaseName('p2'),
  })
  expect(record.databaseName).toBe('kurobello-p2')
  expect(await getProfile('p2')).toEqual(record)
})

test('makeProfileDatabaseName suffixes the frozen kurobello base, never renames it', () => {
  expect(makeProfileDatabaseName('abc-123')).toBe('kurobello-abc-123')
})

test('getActiveProfile returns the most recently used profile among several', async () => {
  await getActiveProfile() // adopts the default first
  await registerProfile({
    id: 'p2',
    label: 'Cuenta de Google',
    kind: 'google',
    databaseName: makeProfileDatabaseName('p2'),
  })

  await touchLastUsed('p2')
  const active = await getActiveProfile()
  expect(active.id).toBe('p2')

  await touchLastUsed(DEFAULT_PROFILE_ID)
  const activeAgain = await getActiveProfile()
  expect(activeAgain.id).toBe(DEFAULT_PROFILE_ID)
})

test('a guest profile and a signed-in profile stay side by side: nothing is ever replaced', async () => {
  await getActiveProfile()
  await registerProfile({
    id: 'google-1',
    label: 'Cuenta de Google',
    kind: 'google',
    databaseName: makeProfileDatabaseName('google-1'),
  })

  const all = await listProfiles()
  expect(all.map((p) => p.id).toSorted()).toEqual([DEFAULT_PROFILE_ID, 'google-1'].toSorted())
})

// docs/error-handling.md §8: every swallow needs a test proving the failure
// path. Same posture as deviceStore.ts: storage trouble degrades to "no
// signal", never blocks boot.
test('listProfiles degrades to an empty array on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi
    .spyOn(profileRegistryDb.profiles, 'toArray')
    .mockRejectedValue(new Error('IDB blocked'))

  expect(await listProfiles()).toEqual([])
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getProfile degrades to undefined on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi
    .spyOn(profileRegistryDb.profiles, 'get')
    .mockRejectedValue(new Error('IDB blocked'))

  expect(await getProfile(DEFAULT_PROFILE_ID)).toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('touchLastUsed is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi
    .spyOn(profileRegistryDb.profiles, 'update')
    .mockRejectedValue(new Error('IDB blocked'))

  await expect(touchLastUsed(DEFAULT_PROFILE_ID)).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getActiveProfile still returns a usable default record when persisting it fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi
    .spyOn(profileRegistryDb.profiles, 'put')
    .mockRejectedValue(new Error('IDB blocked'))

  const active = await getActiveProfile()
  expect(active.id).toBe(DEFAULT_PROFILE_ID)
  expect(active.databaseName).toBe(DEFAULT_PROFILE_DATABASE_NAME)
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})
