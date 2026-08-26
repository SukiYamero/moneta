import { afterEach, expect, test, vi } from 'vitest'
import { deviceDb } from '@/lib/deviceStore'
import {
  __clearRegistryForTests,
  DEFAULT_PROFILE_DATABASE_NAME,
  DEFAULT_PROFILE_ID,
  getActiveProfile,
  getActiveProfileId,
  getProfile,
  listProfiles,
  makeProfileDatabaseName,
  recordSuccessfulPull,
  recordSuccessfulPush,
  registerProfile,
  resolveGoogleProfile,
  setActiveProfileId,
  setDriveFolderId,
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
  await getActiveProfile()
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

test('listProfiles degrades to an empty array on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.profiles, 'toArray').mockRejectedValue(new Error('IDB blocked'))

  expect(await listProfiles()).toEqual([])
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getProfile degrades to undefined on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.profiles, 'get').mockRejectedValue(new Error('IDB blocked'))

  expect(await getProfile(DEFAULT_PROFILE_ID)).toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('touchLastUsed is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.profiles, 'update').mockRejectedValue(new Error('IDB blocked'))

  await expect(touchLastUsed(DEFAULT_PROFILE_ID)).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('resolveGoogleProfile registers a new profile keyed by account on first sign-in', async () => {
  const profile = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })

  expect(profile.kind).toBe('google')
  expect(profile.accountKey).toBe('ana@example.com')
  expect(profile.label).toBe('Ana')
  expect(await getProfile(profile.id)).toEqual(profile)
})

test('resolveGoogleProfile returns the same profile for the same account on a later sign-in, not a duplicate', async () => {
  const first = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })
  const second = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })

  expect(second.id).toBe(first.id)
  const all = await listProfiles()
  expect(all.filter((p) => p.accountKey === 'ana@example.com')).toHaveLength(1)
})

test('resolveGoogleProfile gives two different accounts on the same device two different profiles', async () => {
  const ana = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })
  const beto = await resolveGoogleProfile({ accountKey: 'beto@example.com', label: 'Beto' })

  expect(ana.id).not.toBe(beto.id)
  expect(ana.databaseName).not.toBe(beto.databaseName)
})

test('signing back into a previously-used account makes it the active profile again', async () => {
  const ana = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })
  await resolveGoogleProfile({ accountKey: 'beto@example.com', label: 'Beto' })
  expect((await getActiveProfile()).accountKey).toBe('beto@example.com')

  const anaAgain = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })

  expect(anaAgain.id).toBe(ana.id)
  expect((await getActiveProfile()).id).toBe(ana.id)
})

test('two concurrent resolveGoogleProfile calls for the same account resolve to one profile, not two', async () => {
  const [a, b] = await Promise.all([
    resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' }),
    resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' }),
  ])

  expect(a.id).toBe(b.id)
  const all = await listProfiles()
  expect(all.filter((p) => p.accountKey === 'ana@example.com')).toHaveLength(1)
})

test('getActiveProfile still returns a usable default record when persisting it fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.profiles, 'put').mockRejectedValue(new Error('IDB blocked'))

  const active = await getActiveProfile()
  expect(active.id).toBe(DEFAULT_PROFILE_ID)
  expect(active.databaseName).toBe(DEFAULT_PROFILE_DATABASE_NAME)
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('setDriveFolderId / recordSuccessfulPush / recordSuccessfulPull each patch just their own field', async () => {
  await getActiveProfile()

  await setDriveFolderId(DEFAULT_PROFILE_ID, 'FOLDER123')
  expect((await getProfile(DEFAULT_PROFILE_ID))?.driveFolderId).toBe('FOLDER123')

  await recordSuccessfulPush(DEFAULT_PROFILE_ID, '2026-08-19T12:00:00.000Z')
  expect((await getProfile(DEFAULT_PROFILE_ID))?.lastPushAt).toBe('2026-08-19T12:00:00.000Z')

  await recordSuccessfulPull(DEFAULT_PROFILE_ID, '2026-08-19T13:00:00.000Z')
  const after = await getProfile(DEFAULT_PROFILE_ID)
  expect(after?.lastPullAt).toBe('2026-08-19T13:00:00.000Z')
  expect(after?.driveFolderId).toBe('FOLDER123')
  expect(after?.lastPushAt).toBe('2026-08-19T12:00:00.000Z')
})

test('a profile with no watermark yet has undefined driveFolderId/lastPushAt/lastPullAt', async () => {
  const active = await getActiveProfile()
  expect(active.driveFolderId).toBeUndefined()
  expect(active.lastPushAt).toBeUndefined()
  expect(active.lastPullAt).toBeUndefined()
})

test('getActiveProfileId is undefined on a device that has never set the pointer', async () => {
  expect(await getActiveProfileId()).toBeUndefined()
})

test('the explicit pointer wins over recency once set', async () => {
  await getActiveProfile()
  await registerProfile({
    id: 'p2',
    label: 'Cuenta de Google',
    kind: 'google',
    databaseName: makeProfileDatabaseName('p2'),
  })
  await touchLastUsed('p2')
  await setActiveProfileId(DEFAULT_PROFILE_ID)

  const active = await getActiveProfile()
  expect(active.id).toBe(DEFAULT_PROFILE_ID)
  expect(await getActiveProfileId()).toBe(DEFAULT_PROFILE_ID)
})

test('a pointer naming a since-removed profile falls back to recency, not a throw', async () => {
  await getActiveProfile()
  await setActiveProfileId('a-profile-that-was-never-registered')

  const active = await getActiveProfile()
  expect(active.id).toBe(DEFAULT_PROFILE_ID)
})

test('setActiveProfileId is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.activeProfile, 'put').mockRejectedValue(new Error('IDB blocked'))

  await expect(setActiveProfileId(DEFAULT_PROFILE_ID)).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getActiveProfileId degrades to undefined, falling back to recency, on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.activeProfile, 'get').mockRejectedValue(new Error('IDB blocked'))

  expect(await getActiveProfileId()).toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('removeProfile deletes the profile from the registry', async () => {
  await registerProfile({
    id: 'p-remove',
    label: 'Gone',
    kind: 'google',
    databaseName: makeProfileDatabaseName('p-remove'),
  })
  const { removeProfile } = await import('@/lib/profiles/profileRegistry')

  await removeProfile('p-remove')

  expect(await getProfile('p-remove')).toBeUndefined()
})

test('removeProfile refuses to remove the frozen default profile', async () => {
  await getActiveProfile()
  const { removeProfile } = await import('@/lib/profiles/profileRegistry')

  await removeProfile(DEFAULT_PROFILE_ID)

  expect(await getProfile(DEFAULT_PROFILE_ID)).toBeDefined()
})

test('removeProfile clears a pointer aimed at the profile it just removed', async () => {
  await registerProfile({
    id: 'p-remove-2',
    label: 'Gone',
    kind: 'google',
    databaseName: makeProfileDatabaseName('p-remove-2'),
  })
  await setActiveProfileId('p-remove-2')
  const { removeProfile } = await import('@/lib/profiles/profileRegistry')

  await removeProfile('p-remove-2')

  expect(await getActiveProfileId()).toBeUndefined()
})
