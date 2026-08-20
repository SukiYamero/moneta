import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_SEMILLA } from '@/lib/schema'

vi.mock('@/lib/drive', () => ({
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  findFile: vi.fn(),
  listFiles: vi.fn(),
  readJsonFile: vi.fn(),
  upsertJsonFile: vi.fn(),
  upsertTextFile: vi.fn(),
}))

import {
  createFolder,
  deleteFile,
  findFile,
  listFiles,
  readJsonFile,
  upsertJsonFile,
  upsertTextFile,
} from '@/lib/drive'
import {
  downloadActFile,
  downloadConfigFile,
  downloadMovFile,
  ensureFolder,
  FOLDER_NAME,
  listAppDataFiles,
  listKuroBelloFiles,
  uploadActFile,
  uploadConfigFile,
  uploadMovShard,
  writeLeeme,
  writeYearlyCsv,
} from '@/lib/sync/driveFiles'

const mFindFile = vi.mocked(findFile)
const mCreateFolder = vi.mocked(createFolder)
const mListFiles = vi.mocked(listFiles)
const mReadJsonFile = vi.mocked(readJsonFile)
const mUpsertJsonFile = vi.mocked(upsertJsonFile)
const mUpsertTextFile = vi.mocked(upsertTextFile)
const mDeleteFile = vi.mocked(deleteFile)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('ensureFolder', () => {
  it('reuses an existing KuroBello folder', async () => {
    mFindFile.mockResolvedValue('FOLD')
    expect(await ensureFolder('tok')).toBe('FOLD')
    expect(mCreateFolder).not.toHaveBeenCalled()
  })

  it('creates the folder when none exists', async () => {
    mFindFile.mockResolvedValue(null)
    mCreateFolder.mockResolvedValue('NEW')
    expect(await ensureFolder('tok')).toBe('NEW')
    expect(mCreateFolder).toHaveBeenCalledWith('tok', FOLDER_NAME)
  })

  it("coalesces two concurrent first-ever calls into one folder, not two (specs.md §10.26 §1 sweep: pull() and push() both call ensureFolder() on the same profile's very first sync — onOnline fires runPull() and runPush() without awaiting each other — and an unguarded check-then-create races itself the same way push() used to)", async () => {
    let resolveFind!: (id: string | null) => void
    mFindFile.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveFind = resolve
        }),
    )
    mCreateFolder.mockResolvedValue('NEW')

    const a = ensureFolder('tok')
    const b = ensureFolder('tok')

    resolveFind(null)
    const [idA, idB] = await Promise.all([a, b])

    expect(idA).toBe('NEW')
    expect(idB).toBe('NEW')
    expect(mCreateFolder).toHaveBeenCalledTimes(1) // never two KuroBello folders
  })

  it("keys the coalescing by token — a concurrent call for a *different* account never receives the first account's folder id", async () => {
    mFindFile.mockImplementation(async (token: string) => (token === 'tok-a' ? null : null))
    mCreateFolder.mockImplementation(async (token: string) =>
      token === 'tok-a' ? 'FOLDER-A' : 'FOLDER-B',
    )

    const [idA, idB] = await Promise.all([ensureFolder('tok-a'), ensureFolder('tok-b')])

    expect(idA).toBe('FOLDER-A')
    expect(idB).toBe('FOLDER-B')
    expect(mCreateFolder).toHaveBeenCalledTimes(2)
  })

  it('does not keep coalescing once resolved — a later, genuinely separate call re-checks Drive', async () => {
    mFindFile.mockResolvedValueOnce(null)
    mCreateFolder.mockResolvedValueOnce('FIRST')
    await ensureFolder('tok')

    mFindFile.mockResolvedValueOnce('FIRST') // now exists
    const second = await ensureFolder('tok')

    expect(second).toBe('FIRST')
    expect(mCreateFolder).toHaveBeenCalledTimes(1)
  })
})

describe('listKuroBelloFiles / listAppDataFiles', () => {
  it('scopes to the drive space with a parent', async () => {
    mListFiles.mockResolvedValue([])
    await listKuroBelloFiles('tok', 'FOLD')
    expect(mListFiles).toHaveBeenCalledWith('tok', { parent: 'FOLD', space: 'drive' })
  })

  it('scopes to appDataFolder with no parent', async () => {
    mListFiles.mockResolvedValue([])
    await listAppDataFiles('tok')
    expect(mListFiles).toHaveBeenCalledWith('tok', { space: 'appDataFolder' })
  })
})

const movOp = {
  op: 'put' as const,
  hlc: '000000001-0000-devicea',
  basedOn: null,
  mov: {
    id: 'm1',
    fecha: '2026-08-01',
    seccion: 's',
    categoria: 'c',
    tipo: 'ingreso' as const,
    monto: 1,
    moneda: 'COP' as const,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
}

describe('downloads degrade to null, never throw', () => {
  it('downloadMovFile returns the parsed file when well-shaped, with nothing skipped', async () => {
    const raw = { v: 1, device: 'devicea', periodo: '2026-08', ops: [movOp] }
    mReadJsonFile.mockResolvedValue(raw)
    expect(await downloadMovFile('tok', 'f1')).toEqual({ file: raw, skipped: 0 })
  })

  it('downloadMovFile returns a null file on a malformed file', async () => {
    mReadJsonFile.mockResolvedValue({ not: 'a real op file' })
    expect(await downloadMovFile('tok', 'f1')).toEqual({ file: null, skipped: 0 })
  })

  it('downloadMovFile returns a null file on a network/parse failure, logging why', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mReadJsonFile.mockRejectedValue(new Error('truncated'))
    expect(await downloadMovFile('tok', 'f1')).toEqual({ file: null, skipped: 0 })
    expect(warn).toHaveBeenCalled()
  })

  it('logs and carries the count when a malformed entry inside an otherwise-good file is dropped (specs.md §12, 2026-08-20)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device: 'devicea',
      periodo: '2026-08',
      ops: [movOp, { op: 'weird-op', hlc: movOp.hlc, basedOn: null }],
    })

    const { file, skipped } = await downloadMovFile('tok', 'f1')

    expect(file?.ops).toEqual([movOp])
    expect(skipped).toBe(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('f1'), expect.anything())
  })

  it('downloadActFile / downloadConfigFile behave the same way', async () => {
    mReadJsonFile.mockResolvedValueOnce({ v: 1, device: 'devicea', ops: [] })
    expect(await downloadActFile('tok', 'f1')).toEqual({
      file: { v: 1, device: 'devicea', ops: [] },
      skipped: 0,
    })

    mReadJsonFile.mockResolvedValueOnce('not an object')
    expect(await downloadConfigFile('tok', 'f2')).toEqual({ file: null, skipped: 0 })
  })
})

describe("uploads target this device's own filename", () => {
  it('uploadMovShard writes a monthly filename for a YYYY-MM periodo', async () => {
    mUpsertJsonFile.mockResolvedValue('id1')
    const file = { v: 1, device: 'devicea', periodo: '2026-08', ops: [movOp] }
    await uploadMovShard('tok', 'FOLD', file)
    expect(mUpsertJsonFile).toHaveBeenCalledWith('tok', {
      name: 'mov-devicea-2026-08.json',
      data: file,
      parent: 'FOLD',
    })
  })

  it('uploadMovShard writes a yearly filename for a YYYY periodo (compaction)', async () => {
    mUpsertJsonFile.mockResolvedValue('id1')
    const file = { v: 1, device: 'devicea', periodo: '2026', ops: [movOp] }
    await uploadMovShard('tok', 'FOLD', file)
    expect(mUpsertJsonFile).toHaveBeenCalledWith('tok', {
      name: 'mov-devicea-2026.json',
      data: file,
      parent: 'FOLD',
    })
  })

  it('uploadActFile targets act-<device>.json in the drive folder', async () => {
    mUpsertJsonFile.mockResolvedValue('id1')
    const file = { v: 1, device: 'devicea', ops: [] }
    await uploadActFile('tok', 'FOLD', file)
    expect(mUpsertJsonFile).toHaveBeenCalledWith('tok', {
      name: 'act-devicea.json',
      data: file,
      parent: 'FOLD',
    })
  })

  it('uploadConfigFile targets config-<device>.json in appDataFolder, no parent', async () => {
    mUpsertJsonFile.mockResolvedValue('id1')
    const configOp = {
      op: 'put' as const,
      hlc: '000000001-0000-devicea',
      basedOn: null,
      config: CONFIG_SEMILLA,
    }
    const file = { v: 1, device: 'devicea', ops: [configOp] }
    await uploadConfigFile('tok', file)
    expect(mUpsertJsonFile).toHaveBeenCalledWith('tok', {
      name: 'config-devicea.json',
      data: file,
      space: 'appDataFolder',
    })
  })

  it('deleteMovShard just forwards to drive.ts deleteFile', async () => {
    const { deleteMovShard } = await import('@/lib/sync/driveFiles')
    await deleteMovShard('tok', 'old-id')
    expect(mDeleteFile).toHaveBeenCalledWith('tok', 'old-id')
  })
})

describe('writeLeeme / writeYearlyCsv', () => {
  it('writeLeeme uses the fixed filename and localized content', async () => {
    mUpsertTextFile.mockResolvedValue('leeme-id')
    await writeLeeme('tok', 'FOLD', 'en')
    const call = mUpsertTextFile.mock.calls[0]![1]
    expect(call.name).toBe('LEEME.txt')
    expect(call.content).toContain('KuroBello')
    expect(call.mimeType).toBe('text/plain; charset=utf-8')
    expect(call.parent).toBe('FOLD')
  })

  it('writeYearlyCsv joins the given parts and names the file by year', async () => {
    mUpsertTextFile.mockResolvedValue('csv-id')
    await writeYearlyCsv('tok', 'FOLD', '2026', ['a', 'b', 'c'])
    const call = mUpsertTextFile.mock.calls[0]![1]
    expect(call.name).toBe('movimientos-2026.csv')
    expect(call.content).toBe('abc')
    expect(call.mimeType).toBe('text/csv;charset=utf-8')
  })
})
