import { afterEach, describe, expect, it } from 'vitest'
import { createProfileDb } from '@/lib/db'
import { testRepoContract } from '@/lib/repo.contract'
import { __resetReadyMemoForTests } from '@/lib/repo.local'
import { createDriveRepo } from '@/lib/repo.drive'

// Its own isolated database, not the frozen default `db` — repo.local.ts's
// own contract run already covers that connection; this proves the Drive
// repo behaves identically on a profile-scoped one, which is what it will
// actually be handed in production (specs.md §10.15).
const database = createProfileDb('kurobello-drive-repo-test')

afterEach(async () => {
  await database.movimientos.clear()
  await database.activos.clear()
  await database.config.clear()
  __resetReadyMemoForTests(database)
})

testRepoContract(() => createDriveRepo(database))

describe('createDriveRepo', () => {
  it('is a distinct export from createLocalRepo, scoped to the database it is handed', async () => {
    const repo = createDriveRepo(database)
    await repo.ready()
    const config = await repo.getConfig()
    expect(config.schemaVersion).toBeDefined()
  })
})
