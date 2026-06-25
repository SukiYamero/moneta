import { findFile, createFolder, createJsonFile, type DriveSpace } from '@/lib/drive'
import { CONFIG_SEMILLA } from '@/lib/schema'

export const FOLDER_NAME = 'Moneta'
export const MOVIMIENTOS_FILE = 'movimientos.json'
export const ACTIVOS_FILE = 'activos.json'
export const CONFIG_FILE = 'config.json'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export type DriveLayout = {
  folderId: string
  movimientosFileId: string
  activosFileId: string
  configFileId: string
}

async function ensureJson(
  token: string,
  opts: { name: string; data: unknown; parent?: string; space?: DriveSpace },
): Promise<string> {
  const existing = await findFile(token, {
    name: opts.name,
    parent: opts.parent,
    space: opts.space,
  })
  if (existing) return existing
  return createJsonFile(token, opts)
}

export async function bootstrap(token: string): Promise<DriveLayout> {
  const folderId =
    (await findFile(token, { name: FOLDER_NAME, mimeType: FOLDER_MIME })) ??
    (await createFolder(token, FOLDER_NAME))

  const movimientosFileId = await ensureJson(token, {
    name: MOVIMIENTOS_FILE,
    data: [],
    parent: folderId,
  })
  const activosFileId = await ensureJson(token, { name: ACTIVOS_FILE, data: [], parent: folderId })
  const configFileId = await ensureJson(token, {
    name: CONFIG_FILE,
    data: CONFIG_SEMILLA,
    space: 'appDataFolder',
  })

  return { folderId, movimientosFileId, activosFileId, configFileId }
}
