import {
  createFolder,
  deleteFile,
  findFile,
  listFiles,
  readJsonFile,
  upsertJsonFile,
  upsertTextFile,
  type DriveFileListing,
} from '@/lib/drive'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { buildLeemeContent, leemeFilename } from '@/lib/sync/leeme'
import {
  buildActFilename,
  buildConfigFilename,
  buildMovMonthFilename,
  buildMovYearFilename,
  buildYearlyCsvFilename,
  type ActOpFile,
  type ConfigOpFile,
  type MovOpFile,
} from '@/lib/sync/opLog'
import {
  parseActOpFile,
  parseConfigOpFile,
  parseMovOpFile,
  type ParsedOpFile,
} from '@/lib/sync/validate'

export const FOLDER_NAME = 'KuroBello'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const ensureFolderInFlight = new Map<string, Promise<string>>()

export const ensureFolder = (token: string): Promise<string> => {
  const existing = ensureFolderInFlight.get(token)
  if (existing) return existing
  const inFlight = ensureFolderOnce(token).finally(() => {
    ensureFolderInFlight.delete(token)
  })
  ensureFolderInFlight.set(token, inFlight)
  return inFlight
}

const ensureFolderOnce = async (token: string): Promise<string> =>
  (await findFile(token, { name: FOLDER_NAME, mimeType: FOLDER_MIME })) ??
  (await createFolder(token, FOLDER_NAME))

export const listKuroBelloFiles = (token: string, folderId: string): Promise<DriveFileListing[]> =>
  listFiles(token, { parent: folderId, space: 'drive' })

export const listAppDataFiles = (token: string): Promise<DriveFileListing[]> =>
  listFiles(token, { space: 'appDataFolder' })

export const downloadMovFile = async (
  token: string,
  fileId: string,
): Promise<ParsedOpFile<MovOpFile>> => {
  try {
    const raw = await readJsonFile<unknown>(token, fileId)
    const parsed = parseMovOpFile(raw)
    if (parsed.skipped > 0)
      console.warn(`sync: skipping ${parsed.skipped} malformed entr(y/ies) in ${fileId}`, raw)
    return parsed
  } catch (e) {
    console.warn(`sync: could not download/parse movimiento shard ${fileId}, skipping it`, e)
    return { file: null, skipped: 0 }
  }
}

export const downloadActFile = async (
  token: string,
  fileId: string,
): Promise<ParsedOpFile<ActOpFile>> => {
  try {
    const raw = await readJsonFile<unknown>(token, fileId)
    const parsed = parseActOpFile(raw)
    if (parsed.skipped > 0)
      console.warn(`sync: skipping ${parsed.skipped} malformed entr(y/ies) in ${fileId}`, raw)
    return parsed
  } catch (e) {
    console.warn(`sync: could not download/parse activo file ${fileId}, skipping it`, e)
    return { file: null, skipped: 0 }
  }
}

export const downloadConfigFile = async (
  token: string,
  fileId: string,
): Promise<ParsedOpFile<ConfigOpFile>> => {
  try {
    const raw = await readJsonFile<unknown>(token, fileId)
    const parsed = parseConfigOpFile(raw)
    if (parsed.skipped > 0)
      console.warn(`sync: skipping ${parsed.skipped} malformed entr(y/ies) in ${fileId}`, raw)
    return parsed
  } catch (e) {
    console.warn(`sync: could not download/parse config file ${fileId}, skipping it`, e)
    return { file: null, skipped: 0 }
  }
}

export const uploadMovShard = (
  token: string,
  folderId: string,
  file: MovOpFile,
): Promise<string> => {
  const name =
    file.periodo.length === 7
      ? buildMovMonthFilename(file.device, file.periodo)
      : buildMovYearFilename(file.device, file.periodo)
  return upsertJsonFile(token, { name, data: file, parent: folderId })
}

export const uploadActFile = (token: string, folderId: string, file: ActOpFile): Promise<string> =>
  upsertJsonFile(token, { name: buildActFilename(file.device), data: file, parent: folderId })

export const uploadConfigFile = (token: string, file: ConfigOpFile): Promise<string> =>
  upsertJsonFile(token, {
    name: buildConfigFilename(file.device),
    data: file,
    space: 'appDataFolder',
  })

export const deleteMovShard = (token: string, fileId: string): Promise<void> =>
  deleteFile(token, fileId)

export const writeLeeme = (
  token: string,
  folderId: string,
  locale: SupportedLocale,
): Promise<string> =>
  upsertTextFile(token, {
    name: leemeFilename(),
    content: buildLeemeContent(locale),
    mimeType: 'text/plain; charset=utf-8',
    parent: folderId,
  })

export const writeYearlyCsv = (
  token: string,
  folderId: string,
  year: string,
  parts: readonly string[],
): Promise<string> =>
  upsertTextFile(token, {
    name: buildYearlyCsvFilename(year),
    content: parts.join(''),
    mimeType: 'text/csv;charset=utf-8',
    parent: folderId,
  })
