import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap, FOLDER_NAME } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import { listPendingOperations, __resetOutboxClockForTests, useOutboxStore } from '@/lib/outbox'
import { CONFIG_SEMILLA } from '@/lib/schema'

vi.mock('@/lib/drive', () => ({
  findFile: vi.fn(),
  createFolder: vi.fn(),
  createJsonFile: vi.fn(),
  upsertTextFile: vi.fn(),
}))
import { findFile, createFolder, upsertTextFile } from '@/lib/drive'

const mFindFile = vi.mocked(findFile)
const mCreateFolder = vi.mocked(createFolder)
const mUpsertTextFile = vi.mocked(upsertTextFile)

// Call order inside bootstrap(): ensureFolder() (one findFile, maybe
// createFolder) -> writeLeeme() (one upsertTextFile, unconditionally) ->
// ensureSeedConfigQueued() (one findFile for config-<device>.json).
const mockFolderExists = (): void => {
  mFindFile.mockResolvedValueOnce('FOLD')
}
const mockConfigOnDrive = (exists: boolean): void => {
  mFindFile.mockResolvedValueOnce(exists ? 'CFG' : null)
}

beforeEach(() => {
  vi.clearAllMocks()
  mUpsertTextFile.mockResolvedValue('LEEME_ID')
})

afterEach(async () => {
  await db.outbox.clear()
  await deviceDb.deviceId.clear()
  __resetDeviceIdForTests()
  __resetOutboxClockForTests()
  useOutboxStore.setState({ dirty: false })
})

describe('bootstrap', () => {
  it('creates the KuroBello folder when it does not exist yet', async () => {
    mFindFile.mockResolvedValueOnce(null) // folder lookup
    mCreateFolder.mockResolvedValue('FOLD')
    mockConfigOnDrive(false)

    const layout = await bootstrap('tok')

    expect(layout).toEqual({ folderId: 'FOLD' })
    expect(mCreateFolder).toHaveBeenCalledWith('tok', FOLDER_NAME)
  })

  it('reuses an existing folder rather than creating a second one', async () => {
    mockFolderExists()
    mockConfigOnDrive(true)

    const layout = await bootstrap('tok')

    expect(layout).toEqual({ folderId: 'FOLD' })
    expect(mCreateFolder).not.toHaveBeenCalled()
  })

  it('writes LEEME.txt into the folder on every connect, localized', async () => {
    mockFolderExists()
    mockConfigOnDrive(true)

    await bootstrap('tok')

    expect(mUpsertTextFile).toHaveBeenCalledTimes(1)
    const call = mUpsertTextFile.mock.calls[0]![1]
    expect(call.name).toBe('LEEME.txt')
    expect(call.parent).toBe('FOLD')
    expect(call.content).toContain('KuroBello')
  })

  it('no longer pre-creates movimientos.json/activos.json/config.json — superseded by §10.19', async () => {
    mockFolderExists()
    mockConfigOnDrive(true)

    await bootstrap('tok')

    const { createJsonFile } = await import('@/lib/drive')
    expect(createJsonFile).not.toHaveBeenCalled()
  })

  describe('the first-ever-connection seed config', () => {
    it('queues one config op when this device has never pushed a config file', async () => {
      mockFolderExists()
      mockConfigOnDrive(false)

      await bootstrap('tok')

      const pending = await listPendingOperations()
      expect(pending).toHaveLength(1)
      expect(pending[0]?.entity).toBe('config')
      expect(pending[0]?.operation).toMatchObject({ op: 'put', payload: CONFIG_SEMILLA })
    })

    it('does not queue a second seed if this device already has a config file on Drive', async () => {
      mockFolderExists()
      mockConfigOnDrive(true)

      await bootstrap('tok')

      expect(await listPendingOperations()).toEqual([])
    })

    it('does not queue a second seed if one is already pending locally (a retried bootstrap)', async () => {
      mockFolderExists()
      mockConfigOnDrive(false)
      await bootstrap('tok')
      expect(await listPendingOperations()).toHaveLength(1)

      mockFolderExists()
      mockConfigOnDrive(false) // still not on Drive — hasn't pushed yet
      await bootstrap('tok')

      expect(await listPendingOperations()).toHaveLength(1) // still just one
    })
  })

  it('is idempotent end to end: a second call with everything already present creates nothing new', async () => {
    mockFolderExists()
    mockConfigOnDrive(true)
    await bootstrap('tok')

    mockFolderExists()
    mockConfigOnDrive(true)
    await bootstrap('tok')

    expect(mCreateFolder).not.toHaveBeenCalled()
    expect(await listPendingOperations()).toEqual([])
  })
})
