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
    expect(mCreateFolder).toHaveBeenCalledWith('tok', 'KuroBello')
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

  // specs.md §10.7: the second seeding path must derive monedaPrincipal
  // from the device region too — fixing repo.local.ts and leaving this
  // path on a static COP is the exact twin-fix mistake AGENTS.md warns
  // against (§ How every agent works).
  it("derives the seeded config's monedaPrincipal from the device region", async () => {
    vi.stubGlobal('navigator', { ...navigator, languages: ['es-MX'] })
    mFind.mockResolvedValue(null)
    mCreateFolder.mockResolvedValue('FOLD')
    mCreateJson
      .mockResolvedValueOnce('MOV')
      .mockResolvedValueOnce('ACT')
      .mockResolvedValueOnce('CFG')

    await bootstrap('tok')

    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'config.json',
      data: {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: 'MXN' },
      },
      space: 'appDataFolder',
    })
    vi.unstubAllGlobals()
  })

  // A stored config.json always wins: ensureJson's find-before-create means
  // an existing file is returned as-is, never overwritten with a freshly
  // region-derived seed (specs.md §10.7).
  it('never re-derives config.json when it already exists, even if the device region differs from the stored currency', async () => {
    vi.stubGlobal('navigator', { ...navigator, languages: ['es-MX'] })
    mFind
      .mockResolvedValueOnce('FOLD')
      .mockResolvedValueOnce('MOV')
      .mockResolvedValueOnce('ACT')
      .mockResolvedValueOnce('CFG')

    await bootstrap('tok')

    expect(mCreateJson).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
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
