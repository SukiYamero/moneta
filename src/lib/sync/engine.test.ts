import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Movimiento } from '@/lib/schema'

vi.mock('@/lib/drive', () => ({
  findFile: vi.fn(),
  createFolder: vi.fn(),
  createJsonFile: vi.fn(),
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  upsertJsonFile: vi.fn(),
  upsertTextFile: vi.fn(),
  listFiles: vi.fn(),
  deleteFile: vi.fn(),
  getLastKnownServerTime: vi.fn(() => null),
}))

import {
  findFile,
  readJsonFile,
  upsertJsonFile,
  upsertTextFile,
  listFiles,
  deleteFile,
  getLastKnownServerTime,
} from '@/lib/drive'
import { __resetDeviceIdForTests, deviceDb } from '@/lib/deviceStore'
import { db } from '@/lib/db'
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
  enqueueOperation,
  listPendingOperations,
  useOutboxStore,
} from '@/lib/outbox'
import { __clearKnownTipsForTests } from '@/lib/sync/tip'
import { compactYear, pull, push, startSyncTriggers, useSyncStore } from '@/lib/sync/engine'

const mFindFile = vi.mocked(findFile)
const mReadJsonFile = vi.mocked(readJsonFile)
const mUpsertJsonFile = vi.mocked(upsertJsonFile)
const mListFiles = vi.mocked(listFiles)
const mDeleteFile = vi.mocked(deleteFile)
const mUpsertTextFile = vi.mocked(upsertTextFile)
const mGetLastKnownServerTime = vi.mocked(getLastKnownServerTime)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  fecha: '2026-08-01',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const listing = (id: string, name: string, modifiedTime = 't1') => ({ id, name, modifiedTime })

let profile: ProfileRecord

beforeEach(async () => {
  vi.clearAllMocks()
  mGetLastKnownServerTime.mockReturnValue(null)
  const registered = await registerProfile({
    id: 'p1',
    label: 'Test',
    kind: 'google',
    databaseName: 'kurobello-engine-test',
  })
  await setDriveFolderId(registered.id, 'FOLD')
  profile = (await getProfile('p1'))!
})

afterEach(async () => {
  await __clearRegistryForTests()
  await __clearKnownTipsForTests()
  await deviceDb.syncFileCache.clear()
  await db.outbox.clear()
  __resetOutboxClockForTests()
  useOutboxStore.setState({ dirty: false })
  useSyncStore.setState({ phase: 'idle', pullProgress: null, lastError: null })
  const database = getProfileDatabase('kurobello-engine-test')
  await database.movimientos.clear()
  await database.activos.clear()
  await database.config.clear()
})

describe('pull', () => {
  it('downloads, replays and materializes a remote movement into the local db', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder' ? [] : [listing('f1', 'mov-remdev-2026-08.json')],
    )
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device: 'remdev',
      periodo: '2026-08',
      ops: [{ op: 'put', hlc: '000000001-0000-remdev', basedOn: null, mov: movimiento() }],
    })

    const summary = await pull('tok', profile)

    expect(summary.filesReconciled).toBe(1)
    const database = getProfileDatabase('kurobello-engine-test')
    await expect(database.movimientos.toArray()).resolves.toEqual([movimiento()])
    expect((await getProfile('p1'))?.lastPullAt).toBeDefined()
  })

  it('skips re-downloading a file whose modifiedTime has not changed', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder' ? [] : [listing('f1', 'mov-remdev-2026-08.json', 'SAME')],
    )
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device: 'remdev',
      periodo: '2026-08',
      ops: [{ op: 'put', hlc: '000000001-0000-remdev', basedOn: null, mov: movimiento() }],
    })

    await pull('tok', profile)
    expect(mReadJsonFile).toHaveBeenCalledTimes(1)

    await pull('tok', profile)
    expect(mReadJsonFile).toHaveBeenCalledTimes(1) // still 1 — the cache answered the second pull
  })

  it('degrades a malformed file to "skip it", never throwing and never blanking the rest', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder'
        ? []
        : [listing('f1', 'mov-remdev-2026-08.json'), listing('f2', 'mov-otherdev-2026-08.json')],
    )
    mReadJsonFile.mockImplementation(async (_token, fileId) =>
      fileId === 'f1'
        ? { not: 'a real op file' }
        : {
            v: 1,
            device: 'otherdev',
            periodo: '2026-08',
            ops: [
              {
                op: 'put',
                hlc: '000000001-0000-otherdev',
                basedOn: null,
                mov: movimiento({ id: 'm2' }),
              },
            ],
          },
    )

    await expect(pull('tok', profile)).resolves.toBeDefined()
    const database = getProfileDatabase('kurobello-engine-test')
    const stored = await database.movimientos.toArray()
    expect(stored.map((m) => m.id)).toEqual(['m2'])
  })

  it("folds in this device's own pending outbox ops, so a pull never clobbers a not-yet-pushed local write", async () => {
    mListFiles.mockResolvedValue([]) // nothing on Drive at all yet
    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: movimiento({ id: 'local-only' }),
    })

    await pull('tok', profile)

    const database = getProfileDatabase('kurobello-engine-test')
    const stored = await database.movimientos.toArray()
    expect(stored.map((m) => m.id)).toEqual(['local-only'])
  })

  it('materializes config from a remote file', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder' ? [listing('c1', 'config-remdev.json')] : [],
    )
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device: 'remdev',
      ops: [{ op: 'put', hlc: '000000001-0000-remdev', basedOn: null, config: CONFIG_SEMILLA }],
    })

    await pull('tok', profile)

    const database = getProfileDatabase('kurobello-engine-test')
    const stored = await database.config.get(1)
    expect(stored?.secciones).toEqual(CONFIG_SEMILLA.secciones)
  })
})

describe('push', () => {
  it('creates a fresh shard when none exists yet', async () => {
    mFindFile.mockResolvedValue(null) // no existing shard
    mUpsertJsonFile.mockResolvedValue('new-file-id')
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })

    await push('tok', profile)

    expect(mUpsertJsonFile).toHaveBeenCalledTimes(1)
    const call = mUpsertJsonFile.mock.calls[0]![1] as { data: { ops: unknown[] } }
    expect(call.data.ops).toHaveLength(1)
    await expect(listPendingOperations()).resolves.toEqual([])
    expect((await getProfile('p1'))?.lastPushAt).toBeDefined()
  })

  it('appends to an existing shard rather than overwriting it', async () => {
    mFindFile.mockResolvedValue('existing-id')
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device: 'thisdevice',
      periodo: '2026-08',
      ops: [
        {
          op: 'put',
          hlc: '000000001-0000-x',
          basedOn: null,
          mov: movimiento({ id: 'already-there' }),
        },
      ],
    })
    mUpsertJsonFile.mockResolvedValue('existing-id')
    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: movimiento({ id: 'new-one' }),
    })

    await push('tok', profile)

    const call = mUpsertJsonFile.mock.calls[0]![1] as { data: { ops: { mov?: { id: string } }[] } }
    expect(call.data.ops.map((o) => o.mov?.id)).toEqual(['already-there', 'new-one'])
  })

  it('defers instead of overwriting blind when an existing shard cannot be verified', async () => {
    mFindFile.mockResolvedValue('existing-id')
    mReadJsonFile.mockRejectedValue(new Error('network blip'))
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })

    await push('tok', profile)

    expect(mUpsertJsonFile).not.toHaveBeenCalled()
    await expect(listPendingOperations()).resolves.toHaveLength(1) // still queued, nothing lost
    expect((await getProfile('p1'))?.lastPushAt).toBeUndefined()
  })

  it('is a no-op when the outbox is empty', async () => {
    await push('tok', profile)
    expect(mFindFile).not.toHaveBeenCalled()
    expect(mUpsertJsonFile).not.toHaveBeenCalled()
  })
})

describe('compactYear', () => {
  const device = 'devicea'

  beforeEach(async () => {
    // Pins getDeviceId() to a known value via the real device-id table
    // (rather than mocking the module) so compactYear's own "only this
    // device's own files" filter has something real to match against.
    __resetDeviceIdForTests()
    await deviceDb.deviceId.put({ id: 1, value: device })
  })

  afterEach(async () => {
    await deviceDb.deviceId.clear()
    __resetDeviceIdForTests()
  })

  it('uploads the compacted yearly file, then deletes the originals, then writes the CSV/LEEME', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder'
        ? []
        : [
            listing('m1', `mov-${device}-2025-01.json`),
            listing('m2', `mov-${device}-2025-02.json`),
          ],
    )

    mReadJsonFile.mockImplementation(async (_token, fileId) =>
      fileId === 'm1'
        ? {
            v: 1,
            device,
            periodo: '2025-01',
            ops: [
              {
                op: 'put',
                hlc: '000000001-0000-devicea',
                basedOn: null,
                mov: movimiento({ id: 'jan' }),
              },
            ],
          }
        : {
            v: 1,
            device,
            periodo: '2025-02',
            ops: [
              {
                op: 'put',
                hlc: '000000002-0000-devicea',
                basedOn: null,
                mov: movimiento({ id: 'feb' }),
              },
            ],
          },
    )
    mUpsertJsonFile.mockResolvedValue('yearly-id')

    const compacted = await compactYear('tok', profile, '2025', [], 'en')

    expect(compacted).toBe(true)
    expect(mDeleteFile).toHaveBeenCalledWith('tok', 'm1')
    expect(mDeleteFile).toHaveBeenCalledWith('tok', 'm2')
    // uploadMovShard + writeYearlyCsv + writeLeeme all go through upsert*File
    expect(mUpsertJsonFile).toHaveBeenCalled()
  })

  it("writes the yearly CSV from the full merged movimientos, not just this device's own year — otherwise a second device compacting the same year would silently overwrite the CSV with an incomplete view", async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder' ? [] : [listing('m1', `mov-${device}-2025-01.json`)],
    )
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device,
      periodo: '2025-01',
      ops: [
        { op: 'put', hlc: '000000001-0000-devicea', basedOn: null, mov: movimiento({ id: 'own' }) },
      ],
    })
    mUpsertJsonFile.mockResolvedValue('yearly-id')

    // The already-globally-merged set a pull would have computed, including
    // a movement only *another* device ever created that year.
    const allMovimientos = [
      movimiento({ id: 'own', fecha: '2025-01-15' }),
      movimiento({ id: 'from-other-device', fecha: '2025-06-01' }),
      movimiento({ id: 'different-year', fecha: '2024-01-01' }), // must be excluded
    ]

    await compactYear('tok', profile, '2025', allMovimientos, 'en')

    const csvCall = mUpsertTextFile.mock.calls.find(
      (call) => call[1].name === 'movimientos-2025.csv',
    )
    expect(csvCall).toBeDefined()
    expect(csvCall![1].content).toContain('own')
    expect(csvCall![1].content).toContain('from-other-device')
    expect(csvCall![1].content).not.toContain('different-year')
  })

  it('aborts without deleting anything if any one shard cannot be verified', async () => {
    mListFiles.mockImplementation(async (_token, opts) =>
      opts.space === 'appDataFolder'
        ? []
        : [
            listing('m1', `mov-${device}-2025-01.json`),
            listing('m2', `mov-${device}-2025-02.json`),
          ],
    )
    mReadJsonFile.mockImplementation(async (_token, fileId) =>
      fileId === 'm1' ? { not: 'valid' } : { v: 1, device, periodo: '2025-02', ops: [] },
    )

    const compacted = await compactYear('tok', profile, '2025', [], 'en')

    expect(compacted).toBe(false)
    expect(mDeleteFile).not.toHaveBeenCalled()
  })

  it('is a no-op when this device has no monthly files for the year', async () => {
    mListFiles.mockResolvedValue([])
    const compacted = await compactYear('tok', profile, '2025', [], 'en')
    expect(compacted).toBe(false)
    expect(mUpsertJsonFile).not.toHaveBeenCalled()
  })
})

describe('startSyncTriggers', () => {
  let handle: ReturnType<typeof startSyncTriggers> | undefined

  afterEach(() => {
    handle?.stop()
    handle = undefined
  })

  it('pulls on "online", and also pushes when the outbox is dirty', async () => {
    mListFiles.mockResolvedValue([])
    mFindFile.mockResolvedValue(null)
    mUpsertJsonFile.mockResolvedValue('id')
    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })

    handle = startSyncTriggers(() => ({ token: 'tok', profile }))
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(mListFiles).toHaveBeenCalled()) // the pull
    await vi.waitFor(() => expect(mUpsertJsonFile).toHaveBeenCalled()) // the push, since dirty
  })

  it('does nothing when there is no sync context yet (e.g. no Drive-linked profile)', () => {
    handle = startSyncTriggers(() => null)
    expect(() => window.dispatchEvent(new Event('online'))).not.toThrow()
    expect(mListFiles).not.toHaveBeenCalled()
  })

  it('pushes on pagehide only when the outbox is dirty', async () => {
    mFindFile.mockResolvedValue(null)
    mUpsertJsonFile.mockResolvedValue('id')
    handle = startSyncTriggers(() => ({ token: 'tok', profile }))

    window.dispatchEvent(new Event('pagehide'))
    expect(mUpsertJsonFile).not.toHaveBeenCalled() // nothing pending yet

    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    window.dispatchEvent(new Event('pagehide'))
    await vi.waitFor(() => expect(mUpsertJsonFile).toHaveBeenCalled())
  })

  it('debounces a push after the outbox goes dirty', async () => {
    mFindFile.mockResolvedValue(null)
    mUpsertJsonFile.mockResolvedValue('id')
    handle = startSyncTriggers(() => ({ token: 'tok', profile }), { debounceMs: 20 })

    await enqueueOperation({ entity: 'movimiento', op: 'put', payload: movimiento() })
    expect(mUpsertJsonFile).not.toHaveBeenCalled() // not yet — still inside the debounce window

    await vi.waitFor(() => expect(mUpsertJsonFile).toHaveBeenCalled(), { timeout: 1000 })
  })

  it('stop() removes every listener — a later event fires nothing', async () => {
    mListFiles.mockResolvedValue([])
    handle = startSyncTriggers(() => ({ token: 'tok', profile }))
    handle.stop()
    handle = undefined

    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mListFiles).not.toHaveBeenCalled()
  })
})
