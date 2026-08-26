import { findFile } from '@/lib/drive'
import { getDeviceId } from '@/lib/deviceStore'
import { detectLocale } from '@/lib/i18n/detectLocale'
import { enqueueOperation, listPendingOperations } from '@/lib/outbox'
import { buildSeedConfig } from '@/lib/seedConfig'
import { ensureFolder, FOLDER_NAME, writeLeeme } from '@/lib/sync/driveFiles'
import { buildConfigFilename } from '@/lib/sync/opLog'

export { FOLDER_NAME }

export type DriveLayout = {
  folderId: string
}

export const bootstrap = async (token: string): Promise<DriveLayout> => {
  const folderId = await ensureFolder(token)
  await writeLeeme(token, folderId, detectLocale())
  await ensureSeedConfigQueued(token)
  return { folderId }
}

const ensureSeedConfigQueued = async (token: string): Promise<void> => {
  const device = await getDeviceId()
  const alreadyOnDrive = await findFile(token, {
    name: buildConfigFilename(device),
    space: 'appDataFolder',
  })
  if (alreadyOnDrive) return

  const pending = await listPendingOperations()
  if (pending.some((entry) => entry.entity === 'config')) return

  await enqueueOperation({ entity: 'config', op: 'put', payload: buildSeedConfig() })
}
