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
    await useBootStore.getState().run()
    const active = getActiveProfileBinding()!.profile

    const result = await switchToProfile(active)

    expect(result).toEqual({ outcome: 'noop' })
    expect(mStopSyncSession).not.toHaveBeenCalled()
    expect(mStartSyncSession).not.toHaveBeenCalled()
  })

  it('rebinds the repo, the outbox and the data store to the target profile', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run()
    expect(getActiveProfileBinding()!.profile.id).toBe(DEFAULT_PROFILE_ID)

    await registerProfile({
      id: 'switch-target',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-target',
    })
    const targetDb = getProfileDatabase('kurobello-switch-target')
    await targetDb.profileOwner.put({ id: 1, kind: 'google', createdAt: 'T1' })
    const target = (await getProfile('switch-target'))!

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'switched' })
    expect(getActiveProfileBinding()!.profile.id).toBe('switch-target')
    expect(await getActiveProfileId()).toBe('switch-target')
    expect(mStopSyncSession).toHaveBeenCalled()
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

  it('reports failure and reverts the pointer when run() completes without actually rebinding to the target', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run()
    const before = getActiveProfileBinding()!.profile

    await registerProfile({
      id: 'switch-run-fails',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-run-fails',
    })
    const targetDb = getProfileDatabase('kurobello-switch-run-fails')
    await targetDb.profileOwner.put({ id: 1, kind: 'google', createdAt: 'T1' })
    const target = (await getProfile('switch-run-fails'))!

    const runSpy = vi.spyOn(useBootStore.getState(), 'run').mockResolvedValue(undefined)

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'switch-failed' })
    expect(getActiveProfileBinding()!.profile.id).toBe(before.id)
    expect(await getActiveProfileId()).toBe(before.id)
    expect(mStopSyncSession).not.toHaveBeenCalled()
    expect(mStartSyncSession).not.toHaveBeenCalled()

    runSpy.mockRestore()
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

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'profile-database-gone' })
    expect(getActiveProfileBinding()!.profile.id).toBe(DEFAULT_PROFILE_ID)
    expect(await getActiveProfileId()).not.toBe('switch-gone')
    expect(mStopSyncSession).not.toHaveBeenCalled()
  })

  it('reports a check failure, distinct from profile-database-gone, when reading the target owner marker throws', async () => {
    const { useBootStore } = await import('@/lib/boot')
    await useBootStore.getState().run()

    await registerProfile({
      id: 'switch-check-fails',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-switch-check-fails',
    })
    const targetDb = getProfileDatabase('kurobello-switch-check-fails')
    await targetDb.profileOwner.put({ id: 1, kind: 'google', createdAt: 'T1' })
    const target = (await getProfile('switch-check-fails'))!

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getSpy = vi
      .spyOn(targetDb.profileOwner, 'get')
      .mockRejectedValue(new Error('IDB blocked'))

    const result = await switchToProfile(target)

    expect(result).toEqual({ outcome: 'switch-check-failed' })
    expect(getActiveProfileBinding()!.profile.id).toBe(DEFAULT_PROFILE_ID)
    expect(await getActiveProfileId()).not.toBe('switch-check-fails')
    expect(mStopSyncSession).not.toHaveBeenCalled()
    expect(mStartSyncSession).not.toHaveBeenCalled()

    getSpy.mockRestore()
    warn.mockRestore()
  })

  it('removeProfile deletes the registry row for a gone profile, never the default profile', async () => {
    const { getActiveProfile } = await import('@/lib/profiles')
    await getActiveProfile()
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
