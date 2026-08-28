import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { findFile, upsertJsonFile } from '@/lib/drive'
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
  setOutboxDatabase,
  useOutboxStore,
} from '@/lib/outbox'
import { __clearKnownTipsForTests } from '@/lib/sync/tip'
import { push, useSyncStore } from '@/lib/sync/engine'

const mFindFile = vi.mocked(findFile)
const mUpsertJsonFile = vi.mocked(upsertJsonFile)

let profileA: ProfileRecord
let profileB: ProfileRecord

beforeEach(async () => {
  vi.clearAllMocks()
  const regA = await registerProfile({
    id: 'pA2',
    label: 'A',
    kind: 'google',
    databaseName: 'kurobello-crosstest-pusha',
  })
  await setDriveFolderId(regA.id, 'FOLD_A')
  profileA = (await getProfile('pA2'))!
  const regB = await registerProfile({
    id: 'pB2',
    label: 'B',
    kind: 'google',
    databaseName: 'kurobello-crosstest-pushb',
  })
  await setDriveFolderId(regB.id, 'FOLD_B')
  profileB = (await getProfile('pB2'))!
})

afterEach(async () => {
  await __clearRegistryForTests()
  await __clearKnownTipsForTests()
  await db.outbox.clear()
  __resetOutboxClockForTests()
  useOutboxStore.setState({ dirty: false })
  useSyncStore.setState({ phase: 'idle', pullProgress: null, lastError: null })
  setOutboxDatabase(db)
})

describe('cross-profile push coalescing', () => {
  it("a push for profile B started while profile A's push is in flight is not silently swallowed by A's promise, even though boot.ts's rebind path never waits for an in-flight push before redirecting the outbox", async () => {
    const dbA = getProfileDatabase('kurobello-crosstest-pusha')
    const dbB = getProfileDatabase('kurobello-crosstest-pushb')

    setOutboxDatabase(dbA)
    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: {
        id: 'mA',
        fecha: '2026-08-01',
        categoria: 'c',
        tipo: 'ingreso',
        monto: 1,
        moneda: 'COP',
        createdAt: 'x',
      },
    })

    const findResolvers: ((v: string | null) => void)[] = []
    mFindFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          findResolvers.push(resolve)
        }),
    )
    mUpsertJsonFile.mockResolvedValue('file-id')

    const pushA = push('tokA', profileA)

    setOutboxDatabase(dbB)
    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: {
        id: 'mB',
        fecha: '2026-08-01',
        categoria: 'c',
        tipo: 'ingreso',
        monto: 1,
        moneda: 'COP',
        createdAt: 'x',
      },
    })

    const pushB = push('tokB', profileB)

    await vi.waitFor(() => expect(findResolvers).toHaveLength(2))
    for (const resolve of findResolvers) resolve(null)
    await Promise.all([pushA, pushB])

    const bPending = await dbB.outbox.toArray()
    expect(bPending).toEqual([])
    expect(mUpsertJsonFile).toHaveBeenCalledWith(
      'tokA',
      expect.objectContaining({ parent: 'FOLD_A' }),
    )
    expect(mUpsertJsonFile).toHaveBeenCalledWith(
      'tokB',
      expect.objectContaining({ parent: 'FOLD_B' }),
    )
  })
})
