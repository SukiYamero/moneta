import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bootstrap } from '@/lib/bootstrap'
import { CONFIG_SEMILLA } from '@/lib/schema'

vi.mock('@/lib/drive', () => ({
  findFile: vi.fn(),
  createFolder: vi.fn(),
  createJsonFile: vi.fn(),
}))
import { findFile, createFolder, createJsonFile } from '@/lib/drive'

const mFind = vi.mocked(findFile)
const mCreateFolder = vi.mocked(createFolder)
const mCreateJson = vi.mocked(createJsonFile)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('bootstrap', () => {
  it('creates folder, data files and seeded config when nothing exists', async () => {
    mFind.mockResolvedValue(null)
    mCreateFolder.mockResolvedValue('FOLD')
    mCreateJson
      .mockResolvedValueOnce('MOV')
      .mockResolvedValueOnce('ACT')
      .mockResolvedValueOnce('CFG')

    const layout = await bootstrap('tok')

    expect(layout).toEqual({
      folderId: 'FOLD',
      movimientosFileId: 'MOV',
      activosFileId: 'ACT',
      configFileId: 'CFG',
    })
    expect(mCreateFolder).toHaveBeenCalledWith('tok', 'Moneta')
    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'movimientos.json',
      data: [],
      parent: 'FOLD',
    })
    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'activos.json',
      data: [],
      parent: 'FOLD',
    })
    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'config.json',
      data: CONFIG_SEMILLA,
      space: 'appDataFolder',
    })
  })

  it('is idempotent: reuses existing folder and files, creating nothing', async () => {
    mFind
      .mockResolvedValueOnce('FOLD') // folder
      .mockResolvedValueOnce('MOV') // movimientos
      .mockResolvedValueOnce('ACT') // activos
      .mockResolvedValueOnce('CFG') // config

    const layout = await bootstrap('tok')

    expect(layout).toEqual({
      folderId: 'FOLD',
      movimientosFileId: 'MOV',
      activosFileId: 'ACT',
      configFileId: 'CFG',
    })
    expect(mCreateFolder).not.toHaveBeenCalled()
    expect(mCreateJson).not.toHaveBeenCalled()
  })
})
