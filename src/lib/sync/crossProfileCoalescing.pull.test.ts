import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import { readJsonFile, listFiles, getLastKnownServerTime } from '@/lib/drive'
import { deviceDb } from '@/lib/deviceStore'
import { db } from '@/lib/db'
import {
  __clearRegistryForTests,
  getProfile,
  getProfileDatabase,
  registerProfile,
  setDriveFolderId,
} from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import { __resetOutboxClockForTests, useOutboxStore } from '@/lib/outbox'
import { __clearKnownTipsForTests } from '@/lib/sync/tip'
import { pull, useSyncStore } from '@/lib/sync/engine'

const mReadJsonFile = vi.mocked(readJsonFile)
const mListFiles = vi.mocked(listFiles)
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

let profileA: ProfileRecord
let profileB: ProfileRecord

beforeEach(async () => {
  vi.clearAllMocks()
  mGetLastKnownServerTime.mockReturnValue(null)
  const regA = await registerProfile({
    id: 'pA',
    label: 'A',
    kind: 'google',
    databaseName: 'kurobello-crosstest-a',
  })
  await setDriveFolderId(regA.id, 'FOLD_A')
  profileA = (await getProfile('pA'))!

  const regB = await registerProfile({
    id: 'pB',
    label: 'B',
    kind: 'google',
    databaseName: 'kurobello-crosstest-b',
  })
  await setDriveFolderId(regB.id, 'FOLD_B')
  profileB = (await getProfile('pB'))!
})

afterEach(async () => {
  await __clearRegistryForTests()
  await __clearKnownTipsForTests()
  await deviceDb.syncFileCache.clear()
  await db.outbox.clear()
  __resetOutboxClockForTests()
  useOutboxStore.setState({ dirty: false })
  useSyncStore.setState({ phase: 'idle', pullProgress: null, lastError: null })
  const dbA = getProfileDatabase('kurobello-crosstest-a')
  await dbA.movimientos.clear()
  const dbB = getProfileDatabase('kurobello-crosstest-b')
  await dbB.movimientos.clear()
})

describe('cross-profile pull coalescing (lead 1 — Track AB review)', () => {
  it("a pull for profile B started while profile A pull is in flight must populate B, not silently ride on A's promise (reproduced against the unkeyed guard before this fix)", async () => {
    const resolvers: ((files: ReturnType<typeof listing>[]) => void)[] = []
    mListFiles.mockImplementation((_token, opts) =>
      opts.space === 'appDataFolder'
        ? Promise.resolve([])
        : new Promise((resolve) => {
            resolvers.push(resolve)
          }),
    )
    mReadJsonFile.mockResolvedValue({
      v: 1,
      device: 'remdev',
      periodo: '2026-08',
      ops: [{ op: 'put', hlc: '000000001-0000-remdev', basedOn: null, mov: movimiento() }],
    })

    const pullA = pull('tokA', profileA, 'en')
    const pullB = pull('tokB', profileB, 'en')

    await vi.waitFor(() => expect(resolvers).toHaveLength(2))
    for (const resolve of resolvers) resolve([listing('f1', 'mov-remdev-2026-08.json')])

    await Promise.all([pullA, pullB])

    const dbA = getProfileDatabase('kurobello-crosstest-a')
    const dbB = getProfileDatabase('kurobello-crosstest-b')
    await expect(dbA.movimientos.toArray()).resolves.toEqual([movimiento()])
    await expect(dbB.movimientos.toArray()).resolves.toEqual([movimiento()])
  })
})
