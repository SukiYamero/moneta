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

beforeEach(async () => {
  vi.clearAllMocks()
  const regA = await registerProfile({
    id: 'scopeA',
    label: 'A',
    kind: 'google',
    databaseName: 'kurobello-outboxscope-a',
  })
  await setDriveFolderId(regA.id, 'FOLD_A')
  profileA = (await getProfile('scopeA'))!
  const regB = await registerProfile({
    id: 'scopeB',
    label: 'B',
    kind: 'google',
    databaseName: 'kurobello-outboxscope-b',
  })
  await setDriveFolderId(regB.id, 'FOLD_B')
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

describe('push() removes its own operations from the pushing profile’s outbox, not whichever table setOutboxDatabase() currently points to', () => {
  it('a profile switch (setOutboxDatabase redirect) happening while A’s push is still in flight does not strand A’s already-uploaded op in A’s own outbox', async () => {
    const dbA = getProfileDatabase('kurobello-outboxscope-a')
    const dbB = getProfileDatabase('kurobello-outboxscope-b')

    setOutboxDatabase(dbA)
    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: {
        id: 'mA',
        fecha: '2026-08-01',
        seccion: 's',
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

    await vi.waitFor(() => expect(findResolvers).toHaveLength(1))
    for (const resolve of findResolvers) resolve(null)
    await pushA

    expect(mUpsertJsonFile).toHaveBeenCalledWith(
      'tokA',
      expect.objectContaining({ parent: 'FOLD_A' }),
    )
    expect(await dbA.outbox.toArray()).toEqual([])
    expect(await dbB.outbox.toArray()).toEqual([])
  })
})
