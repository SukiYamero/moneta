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
  setOutboxDatabase,
  useOutboxStore,
} from '@/lib/outbox'
import { __clearKnownTipsForTests } from '@/lib/sync/tip'
import { startSyncTriggers, useSyncStore } from '@/lib/sync/engine'

const mFindFile = vi.mocked(findFile)
const mUpsertJsonFile = vi.mocked(upsertJsonFile)

let profile: ProfileRecord

beforeEach(async () => {
  vi.clearAllMocks()
  const reg = await registerProfile({
    id: 'pDebounce',
    label: 'X',
    kind: 'google',
    databaseName: 'kurobello-debounce-test',
  })
  await setDriveFolderId(reg.id, 'FOLD')
  profile = (await getProfile('pDebounce'))!
  setOutboxDatabase(getProfileDatabase('kurobello-debounce-test'))
})

afterEach(async () => {
  await __clearRegistryForTests()
  await __clearKnownTipsForTests()
  await getProfileDatabase('kurobello-debounce-test').outbox.clear()
  __resetOutboxClockForTests()
  __resetOutboxDatabaseForTests()
  useOutboxStore.setState({ dirty: false })
  useSyncStore.setState({ phase: 'idle', pullProgress: null, lastError: null })
})

describe('trigger wiring: re-arming the debounce', () => {
  it('a write enqueued while dirty is already true (an earlier push still in flight) still gets pushed, via a re-armed debounce round once that push settles', async () => {
    const findResolvers: ((v: string | null) => void)[] = []
    mFindFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          findResolvers.push(resolve)
        }),
    )
    mUpsertJsonFile.mockResolvedValue('file-id')

    const handle = startSyncTriggers(() => ({ token: 'tok', profile, locale: 'en' }), {
      debounceMs: 10,
    })

    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: {
        id: 'op1',
        fecha: '2026-08-01',
        seccion: 's',
        categoria: 'c',
        tipo: 'ingreso',
        monto: 1,
        moneda: 'COP',
        createdAt: 'x',
      },
    })

    await vi.waitFor(() => expect(findResolvers).toHaveLength(1))

    await enqueueOperation({
      entity: 'movimiento',
      op: 'put',
      payload: {
        id: 'op2',
        fecha: '2026-08-01',
        seccion: 's',
        categoria: 'c',
        tipo: 'ingreso',
        monto: 1,
        moneda: 'COP',
        createdAt: 'x',
      },
    })

    findResolvers[0]?.(null)

    await vi.waitFor(() => expect(findResolvers).toHaveLength(2))
    findResolvers[1]?.(null)

    await vi.waitFor(async () =>
      expect(await getProfileDatabase('kurobello-debounce-test').outbox.toArray()).toEqual([]),
    )

    handle.stop()
  })
})
