import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sync/syncSession', () => ({
  startSyncSession: vi.fn(),
  stopSyncSession: vi.fn(),
}))

import { useAuthStore } from '@/lib/authStore'
import { __resetBootStoreForTests } from '@/lib/boot'
import { useDataStore } from '@/lib/dataStore'
import { getActiveProfileBinding, __resetRepoBindingForTests } from '@/lib/repoProvider'
import { __resetOutboxDatabaseForTests } from '@/lib/outbox'
import { startSyncSession, stopSyncSession } from '@/lib/sync/syncSession'
import {
  __clearRegistryForTests,
  DEFAULT_PROFILE_ID,
  getActiveProfileId,
  getProfile,
  getProfileDatabase,
  registerProfile,
  removeProfile,
} from '@/lib/profiles'
import { switchToProfile } from '@/lib/profiles/switchProfile'

const mStartSyncSession = vi.mocked(startSyncSession)
const mStopSyncSession = vi.mocked(stopSyncSession)

const resetAuth = () =>
  useAuthStore.setState({
    status: 'authenticated',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
  })

beforeEach(async () => {
  vi.clearAllMocks()
  await __clearRegistryForTests()
  __resetRepoBindingForTests()
  __resetBootStoreForTests()
  __resetOutboxDatabaseForTests()
  useDataStore.setState({ movimientos: [], activos: [], config: null, status: 'idle', error: null })
  resetAuth()
})

afterEach(async () => {
  await __clearRegistryForTests()
  __resetRepoBindingForTests()
  __resetBootStoreForTests()
  __resetOutboxDatabaseForTests()
})

describe('switchToProfile', () => {
  it('is a no-op when the target is already the active profile', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run() // establishes the default profile as bound first
    const active = getActiveProfileBinding()!.profile

    const result = await switchToProfile(active)

    expect(result).toEqual({ outcome: 'noop' })
    expect(mStopSyncSession).not.toHaveBeenCalled()
    expect(mStartSyncSession).not.toHaveBeenCalled()
  })

  it('rebinds the repo, the outbox and the data store to the target profile', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run() // binds the default local profile first
    expect(getActiveProfileBinding()!.profile.id).toBe(DEFAULT_PROFILE_ID)

    await registerProfile({
      id: 'switch-target',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-target',
    })
    // The switcher's own pre-check reads the target's owner marker — a
    // profile only ever reachable through the switcher after having been
    // bound at least once (specs.md §10.31 §2's reasoning), so simulate
    // that prior bind directly rather than going through a full sign-in.
    const targetDb = getProfileDatabase('kurobello-switch-target')
    await targetDb.profileOwner.put({ id: 1, kind: 'google', createdAt: 'T1' })
    const target = (await getProfile('switch-target'))!

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'switched' })
    expect(getActiveProfileBinding()!.profile.id).toBe('switch-target')
    expect(await getActiveProfileId()).toBe('switch-target')
    expect(mStopSyncSession).toHaveBeenCalled()
    // Guest/no-Drive default auth state (resetAuth above) is not eligible.
    expect(mStartSyncSession).not.toHaveBeenCalled()
  })

  it('starts sync only when the newly bound profile belongs to the currently authenticated account', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run()

    await registerProfile({
      id: 'switch-eligible',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-eligible',
      accountKey: 'sub-1',
    })
    const targetDb = getProfileDatabase('kurobello-switch-eligible')
    await targetDb.profileOwner.put({ id: 1, kind: 'google', accountKey: 'sub-1', createdAt: 'T1' })
    const target = (await getProfile('switch-eligible'))!

    useAuthStore.setState({
      status: 'authenticated',
      drive: { folderId: 'F' },
      user: { sub: 'sub-1', email: 'a@b.com', name: 'Ana' },
    })

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'switched' })
    expect(mStartSyncSession).toHaveBeenCalled()
  })

  it('reports the target profile’s database as gone when its owner marker is missing, without switching', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run()

    await registerProfile({
      id: 'switch-gone',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-gone',
    })
    const target = (await getProfile('switch-gone'))!
    // No owner marker written — simulates a database whose storage was
    // cleared after the profile was registered.

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'profile-database-gone' })
    expect(getActiveProfileBinding()!.profile.id).toBe(DEFAULT_PROFILE_ID) // never rebound
    expect(await getActiveProfileId()).not.toBe('switch-gone')
    expect(mStopSyncSession).not.toHaveBeenCalled()
  })

  it('removeProfile deletes the registry row for a gone profile, never the default profile', async () => {
    const { getActiveProfile } = await import('@/lib/profiles')
    await getActiveProfile() // adopts the default profile so there is a row to (not) remove
    await registerProfile({
      id: 'switch-gone-2',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-gone-2',
    })
    await removeProfile('switch-gone-2')
    expect(await getProfile('switch-gone-2')).toBeUndefined()

    await removeProfile(DEFAULT_PROFILE_ID)
    expect(await getProfile(DEFAULT_PROFILE_ID)).toBeDefined()
  })
})
