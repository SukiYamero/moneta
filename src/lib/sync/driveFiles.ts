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

// driveFiles.ts — where opLog.ts's pure types and validate.ts's shape
// checks meet drive.ts's REST client: listing, downloading + validating,
// and uploading the op-log files specs.md §10.19 lays out. Every download
// degrades per the edge cases (a malformed/truncated file is skipped, never
// thrown); every upload targets this device's own file, per "exactly one
// device ever writes any given file" — there is no cross-device write path
// here to build a conflict-avoidance mechanism for.

// Storage id frozen (AGENTS.md): bootstrap.ts finds the folder by this
// name, so once user data exists renaming it requires a Drive migration —
// it must not track APP_NAME (specs.md §11). Lives here (not bootstrap.ts)
// because every module that names a Drive file — bootstrap included —
// depends on this one, not the other way around.
export const FOLDER_NAME = 'KuroBello'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

// Coalesced against itself for the identical reason engine.ts's push()/
// pull() are (specs.md §10.26 §1's sweep): a device's very first sync calls
// this from both pull() and push(), and `onOnline` fires `runPull()` then
// `runPush()` without awaiting either — an unguarded check-then-create here
// races itself exactly like the reentrancy bug this track exists to close,
// except the two writers create two *different* KuroBello folders instead
// of overwriting one file. `pullInFlight`/`pushInFlight` never protect this,
// since a pull and a push are two different exported functions each independently
// calling `ensureFolder`.
//
// Keyed by `token`, not a single shared slot — a coalescing cache blind to
// *which* account is calling would hand a concurrent call for a second
// account the first account's folder id the instant their two calls
// overlapped, which is not "two tabs of the same account" (a real, accepted
// residual risk — see this track's report) but silently writing one
// account's data into another's Drive folder. Today's architecture only
// ever has one profile's triggers active at a time (`syncSession.ts`), so
// this is defensive rather than reachable — but the fix costs nothing and
// closes a *worse* version of the bug this whole section exists to avoid.
// Each entry is cleared once its own call resolves (success or failure) so
// a later, genuinely separate call for that token re-checks Drive.
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

// --- downloads (untrusted input — degrade, never throw) --------------------
//
// A failed/truncated download (a bad `readJsonFile` — non-JSON bytes, a
// network error) and a well-formed-but-invalid file (validate.ts rejects
// it) both resolve to `null` here: from the replay engine's point of view,
// "couldn't get this file" and "got this file but it's garbage" are the
// same outcome — skip it and keep going, never replay a truncated partial
// as the whole truth.

// `skipped` (validate.ts's ParsedOpFile) is logged right here, once per
// download — this is the I/O layer validate.ts's own header comment points
// to ("callers are I/O code that already knows *which* file/entry it was
// reading"). Never silent (docs/error-handling.md), and the count also
// rides back to the caller so a pull can carry it into `PullSummary`
// (specs.md §12, 2026-08-20) instead of the warning being the only trace.

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

// --- uploads (always this device's own file) --------------------------

/** `file.periodo` decides month vs. year filename — a compacted file just has a shorter periodo. */
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

// --- LEEME.txt + the yearly CSV -----------------------------------------

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

/** `parts` is the exact chunked output of `buildMovimientoCsvParts` (Track S's csv.ts) — joined here, once, at the transport boundary, never re-derived. */
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
