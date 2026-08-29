import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/drive', () => ({
  findFile: vi.fn(),
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  listFiles: vi.fn(),
}))
vi.mock('@/lib/sync/syncSession', () => ({
  stopSyncSession: vi.fn(),
  startSyncSession: vi.fn(),
}))

import { createFolder, deleteFile, findFile, listFiles } from '@/lib/drive'
import type { Movimiento } from '@/lib/schema'
import {
  __clearRegistryForTests,
  getProfile,
  getProfileDatabase,
  registerProfile,
  setDriveFolderId,
} from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import {
  __resetOutboxClockForTests,
  __resetOutboxDatabaseForTests,
  enqueueOperation,
  useOutboxStore,
} from '@/lib/outbox'
import { EraseError, eraseProfileData } from '@/lib/sync/erase'
import { startSyncSession, stopSyncSession } from '@/lib/sync/syncSession'

const mFindFile = vi.mocked(findFile)
const mCreateFolder = vi.mocked(createFolder)
const mDeleteFile = vi.mocked(deleteFile)
const mListFiles = vi.mocked(listFiles)
const mStopSyncSession = vi.mocked(stopSyncSession)
const mStartSyncSession = vi.mocked(startSyncSession)

const listing = (id: string, name: string) => ({ id, name, modifiedTime: 't1' })

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  fecha: '2026-08-01',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const registerTestProfile = async (id: string, folderId: string): Promise<ProfileRecord> => {
  await registerProfile({
    id,
    label: 'Test',
    kind: 'google',
    databaseName: `kurobello-erase-test-${id}`,
  })
  await setDriveFolderId(id, folderId)
  return (await getProfile(id))!
}

const clearTestDatabase = async (databaseName: string): Promise<void> => {
  const database = getProfileDatabase(databaseName)
  await database.movimientos.clear()
  await database.activos.clear()
  await database.outbox.clear()
}

let profileA: ProfileRecord

beforeEach(async () => {
  vi.clearAllMocks()
  mFindFile.mockResolvedValue(null)
  mCreateFolder.mockResolvedValue('FOLD_A_NEW')
  mDeleteFile.mockResolvedValue(undefined)
  mListFiles.mockResolvedValue([])
  __resetOutboxDatabaseForTests()
  __resetOutboxClockForTests()
  useOutboxStore.setState({ dirty: false })
  profileA = await registerTestProfile('a', 'FOLD_A')
})

afterEach(async () => {
  await __clearRegistryForTests()
  await clearTestDatabase('kurobello-erase-test-a')
  await clearTestDatabase('kurobello-erase-test-b')
  __resetOutboxDatabaseForTests()
  __resetOutboxClockForTests()
  useOutboxStore.setState({ dirty: false })
})

describe('eraseProfileData', () => {
  it('stops this profile sync triggers before any Drive delete call fires', async () => {
    const order: string[] = []
    mStopSyncSession.mockImplementation(() => order.push('stop'))
    mDeleteFile.mockImplementation(async () => {
      order.push('delete')
    })
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder' ? [listing('cfgA', 'config-devA.json')] : [],
    )

    await eraseProfileData('tokA', profileA)

    expect(order[0]).toBe('stop')
    expect(order).toContain('delete')
  })

  it('deletes every file in the KuroBello folder and every appData config file, then the folder itself', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder'
        ? [listing('cfgA', 'config-devA.json')]
        : [listing('movA', 'mov-devA-2026-08.json'), listing('leeme', 'LEEME.txt')],
    )

    await eraseProfileData('tokA', profileA)

    const deletedIds = mDeleteFile.mock.calls.map(([, id]) => id)
    expect(deletedIds).toEqual(expect.arrayContaining(['movA', 'leeme', 'cfgA', 'FOLD_A']))
  })

  it('re-provisions a fresh Drive folder and records it, so the next sync does not target the deleted one', async () => {
    await eraseProfileData('tokA', profileA)

    expect(mCreateFolder).toHaveBeenCalledWith('tokA', 'KuroBello')
    await expect(getProfile('a')).resolves.toMatchObject({ driveFolderId: 'FOLD_A_NEW' })
  })

  it('clears local movimientos, activos and the pending outbox for this profile on success', async () => {
    const database = getProfileDatabase(profileA.databaseName)
    await database.movimientos.add(movimiento())
    await enqueueOperation(
      { entity: 'movimiento', op: 'put', payload: movimiento() },
      database,
    )

    await eraseProfileData('tokA', profileA)

    await expect(database.movimientos.toArray()).resolves.toEqual([])
    await expect(database.outbox.toArray()).resolves.toEqual([])
    expect(useOutboxStore.getState().dirty).toBe(false)
  })

  it('restarts sync triggers only after both stages succeed', async () => {
    await eraseProfileData('tokA', profileA)

    expect(mStartSyncSession).toHaveBeenCalledOnce()
  })

  it('surfaces a drive-stage failure without touching local data, and never restarts sync', async () => {
    const database = getProfileDatabase(profileA.databaseName)
    await database.movimientos.add(movimiento())
    mDeleteFile.mockRejectedValueOnce(new Error('network down'))
    mListFiles.mockResolvedValueOnce([listing('movA', 'mov-devA-2026-08.json')])

    const failure = eraseProfileData('tokA', profileA)
    await expect(failure).rejects.toBeInstanceOf(EraseError)
    await expect(failure).rejects.toMatchObject({ stage: 'drive' })

    await expect(database.movimientos.toArray()).resolves.toHaveLength(1)
    expect(mStartSyncSession).not.toHaveBeenCalled()
  })

  it('surfaces a local-stage failure after a successful Drive delete, and never restarts sync', async () => {
    const database = getProfileDatabase(profileA.databaseName)
    const clearSpy = vi.spyOn(database.activos, 'clear').mockRejectedValueOnce(new Error('boom'))

    const failure = eraseProfileData('tokA', profileA)
    await expect(failure).rejects.toBeInstanceOf(EraseError)
    await expect(failure).rejects.toMatchObject({ stage: 'local' })

    expect(mDeleteFile).toHaveBeenCalledWith('tokA', 'FOLD_A')
    expect(mStartSyncSession).not.toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('never issues a Drive call or a local clear scoped to another profile', async () => {
    const profileB = await registerTestProfile('b', 'FOLD_B')
    const databaseB = getProfileDatabase(profileB.databaseName)
    await databaseB.movimientos.add(movimiento({ id: 'other-profile-movement' }))

    mListFiles.mockImplementation(async (token, opts) => {
      if (token !== 'tokA') throw new Error(`unexpected token "${token}" reached driveFiles`)
      if (opts.parent === 'FOLD_B') throw new Error('erase reached profile B folder')
      return []
    })

    await eraseProfileData('tokA', profileA)

    for (const [token] of mDeleteFile.mock.calls) expect(token).toBe('tokA')
    await expect(databaseB.movimientos.toArray()).resolves.toEqual([
      movimiento({ id: 'other-profile-movement' }),
    ])
  })
})
