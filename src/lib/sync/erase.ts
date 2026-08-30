import { deleteFile } from '@/lib/drive'
import { setOutboxDatabase } from '@/lib/outbox'
import { getProfileDatabase, setDriveFolderId, type ProfileRecord } from '@/lib/profiles'
import { ensureFolder, listAppDataFiles, listKuroBelloFiles } from '@/lib/sync/driveFiles'
import { startSyncSession, stopSyncSession } from '@/lib/sync/syncSession'

export type EraseStage = 'drive' | 'local'

export class EraseError extends Error {
  readonly stage: EraseStage

  constructor(stage: EraseStage, cause: unknown) {
    super(`erase: the ${stage} stage failed`, { cause })
    this.name = 'EraseError'
    this.stage = stage
  }
}

const eraseDriveData = async (token: string, profile: ProfileRecord): Promise<void> => {
  const folderId = profile.driveFolderId ?? (await ensureFolder(token))
  const [driveFiles, appDataFiles] = await Promise.all([
    listKuroBelloFiles(token, folderId),
    listAppDataFiles(token),
  ])
  await Promise.all([...driveFiles, ...appDataFiles].map((file) => deleteFile(token, file.id)))
  await deleteFile(token, folderId)

  const freshFolderId = await ensureFolder(token)
  await setDriveFolderId(profile.id, freshFolderId)
}

const eraseLocalData = async (profile: ProfileRecord): Promise<void> => {
  const database = getProfileDatabase(profile.databaseName)
  await database.transaction(
    'rw',
    database.movimientos,
    database.activos,
    database.outbox,
    async () => {
      await database.movimientos.clear()
      await database.activos.clear()
      await database.outbox.clear()
    },
  )
  setOutboxDatabase(database)
}

export const eraseProfileData = async (token: string, profile: ProfileRecord): Promise<void> => {
  stopSyncSession()

  try {
    await eraseDriveData(token, profile)
  } catch (cause) {
    throw new EraseError('drive', cause)
  }

  try {
    await eraseLocalData(profile)
  } catch (cause) {
    throw new EraseError('local', cause)
  }

  startSyncSession()
}
