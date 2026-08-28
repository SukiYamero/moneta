import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({
  resolveActiveProfileBinding: vi.fn(),
  bindActiveProfile: vi.fn(),
  getActiveProfileBinding: vi.fn(),
  getRepo: vi.fn(),
}))
vi.mock('@/lib/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/outbox', () => ({ setOutboxDatabase: vi.fn() }))
vi.mock('@/lib/profiles', () => ({ resumePendingAdoption: vi.fn() }))

import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import {
  bindActiveProfile,
  getActiveProfileBinding,
  getRepo,
  resolveActiveProfileBinding,
  type ProfileBinding,
} from '@/lib/repoProvider'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { setOutboxDatabase } from '@/lib/outbox'
import { resumePendingAdoption } from '@/lib/profiles'
import { __resetBootStoreForTests, invalidateBootForSignOut, useBootStore } from '@/lib/boot'

const mResolveBinding = vi.mocked(resolveActiveProfileBinding)
const mBindActiveProfile = vi.mocked(bindActiveProfile)
const mGetActiveProfileBinding = vi.mocked(getActiveProfileBinding)
const mGetRepo = vi.mocked(getRepo)
const mSetOutboxDatabase = vi.mocked(setOutboxDatabase)
const mResumePendingAdoption = vi.mocked(resumePendingAdoption)

const makeRepo = (readyError?: unknown): Repo =>
  ({
    ready: vi.fn().mockImplementation(() => (readyError ? Promise.reject(readyError) : undefined)),
    movimientos: { list: vi.fn().mockResolvedValue({ items: [] }) },
    activos: { list: vi.fn().mockResolvedValue({ items: [] }) },
    getConfig: vi.fn().mockResolvedValue(CONFIG_SEMILLA),
  }) as unknown as Repo

const makeBinding = (profileId: string, repo: Repo = makeRepo()): ProfileBinding =>
  ({
    profile: {
      id: profileId,
      label: 'Local',
      kind: 'local',
      databaseName: profileId,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: '2026-01-01T00:00:00.000Z',
    },
    database: {} as ProfileBinding['database'],
    repo,
  }) as ProfileBinding

beforeEach(() => {
  vi.clearAllMocks()
  useDataStore.setState({ movimientos: [], activos: [], config: null, status: 'idle', error: null })
  useBootStore.setState({ status: 'idle', error: null })
  mGetActiveProfileBinding.mockReturnValue(null)
  mResumePendingAdoption.mockResolvedValue(undefined)
})

afterEach(() => {
  __resetBootStoreForTests()
})

describe('useBootStore.run()', () => {
  it('resolves the active profile, binds it, and loads data through the bound repo', async () => {
    const repo = makeRepo()
    const binding = makeBinding('kurobello', repo)
    mResolveBinding.mockResolvedValue(binding)
    mGetRepo.mockReturnValue(repo)

    await useBootStore.getState().run()

    expect(mBindActiveProfile).toHaveBeenCalledWith(binding)
    expect(mSetOutboxDatabase).toHaveBeenCalledWith(binding.database)
    expect(useBootStore.getState().status).toBe('ready')
    expect(useDataStore.getState().status).toBe('ready')
    expect(mResumePendingAdoption).toHaveBeenCalledWith(binding.profile)
  })

  it('is idempotent: a second call for the same already-bound profile does not reload, re-announce running, or re-attempt an adoption resume', async () => {
    const repo = makeRepo()
    const binding = makeBinding('kurobello', repo)
    mResolveBinding.mockResolvedValue(binding)
    mGetRepo.mockReturnValue(repo)

    await useBootStore.getState().run()
    mGetActiveProfileBinding.mockReturnValue(binding)
    const loadSpy = vi.spyOn(useDataStore.getState(), 'load')
    mResumePendingAdoption.mockClear()

    const statusesSeen: string[] = []
    const unsub = useBootStore.subscribe((s) => statusesSeen.push(s.status))
    await useBootStore.getState().run()
    unsub()

    expect(loadSpy).not.toHaveBeenCalled()
    expect(statusesSeen).not.toContain('running')
    expect(mResumePendingAdoption).not.toHaveBeenCalled()
  })

  it('rebinds and reloads when a later run resolves a different profile', async () => {
    const repoA = makeRepo()
    const bindingA = makeBinding('profile-a', repoA)
    mResolveBinding.mockResolvedValue(bindingA)
    mGetRepo.mockReturnValue(repoA)
    await useBootStore.getState().run()
    mGetActiveProfileBinding.mockReturnValue(bindingA)

    const movA = {
      id: 'm-a',
      fecha: '2026-01-01',
      categoria: 'cat_sueldo',
      tipo: 'ingreso' as const,
      monto: 100,
      moneda: 'COP' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    useDataStore.setState({ movimientos: [movA] })

    const repoB = makeRepo()
    vi.mocked(repoB.movimientos.list).mockResolvedValue({ items: [] })
    const bindingB = makeBinding('profile-b', repoB)
    mResolveBinding.mockResolvedValue(bindingB)
    mGetRepo.mockReturnValue(repoB)

    await useBootStore.getState().run()

    expect(mBindActiveProfile).toHaveBeenLastCalledWith(bindingB)
    expect(useDataStore.getState().movimientos).toEqual([])
    expect(useDataStore.getState().status).toBe('ready')
  })

  it('lands in status "error" with the RepoErrorCode, never falling back silently, when the repo cannot open', async () => {
    const failingRepo = makeRepo(new RepoError('db unavailable', 'unknown'))
    const binding = makeBinding('kurobello', failingRepo)
    mResolveBinding.mockResolvedValue(binding)
    mGetRepo.mockReturnValue(failingRepo)

    await useBootStore.getState().run()

    expect(useBootStore.getState().status).toBe('error')
    expect(useBootStore.getState().error).toBe('unknown')
  })

  it('lands in status "error" when resolving the active profile itself throws', async () => {
    mResolveBinding.mockRejectedValue(new RepoError('indexeddb unavailable', 'unknown'))

    await useBootStore.getState().run()

    expect(useBootStore.getState().status).toBe('error')
    expect(mBindActiveProfile).not.toHaveBeenCalled()
  })

  it('is idempotent under two back-to-back calls before the first settles', async () => {
    const repo = makeRepo()
    const binding = makeBinding('kurobello', repo)
    mResolveBinding.mockResolvedValue(binding)
    mGetRepo.mockReturnValue(repo)

    const first = useBootStore.getState().run()
    const second = useBootStore.getState().run()
    await Promise.all([first, second])

    expect(mResolveBinding).toHaveBeenCalledOnce()
  })
})

describe('invalidateBootForSignOut', () => {
  it('resets status back to idle, so a later mount does not assume it is already ready', () => {
    useBootStore.setState({ status: 'ready', error: null })

    invalidateBootForSignOut()

    expect(useBootStore.getState().status).toBe('idle')
    expect(useBootStore.getState().error).toBeNull()
  })
})
