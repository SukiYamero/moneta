const FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export type DriveSpace = 'drive' | 'appDataFolder'

export class DriveError extends Error {
  constructor(reason: string) {
    super(`drive: ${reason}`)
    this.name = 'DriveError'
  }
}

const auth = (token: string): HeadersInit => {
  return { Authorization: `Bearer ${token}` }
}

// googleapis.com exposes the `date` response header via Access-Control-Expose-Headers, even on a 403.
let lastServerDateMs: number | null = null

export const getLastKnownServerTime = (): number | null => lastServerDateMs

const observeServerDate = (res: Response): void => {
  const header = res.headers.get('date')
  if (!header) return
  const parsed = Date.parse(header)
  if (!Number.isNaN(parsed)) lastServerDateMs = parsed
}

const ok = async (res: Response, what: string): Promise<Response> => {
  observeServerDate(res)
  if (!res.ok) throw new DriveError(`${what} ${res.status}`)
  return res
}

export const findFile = async (
  token: string,
  opts: { name: string; mimeType?: string; parent?: string; space?: DriveSpace },
): Promise<string | null> => {
  const q = [`name = '${opts.name}'`, 'trashed = false']
  if (opts.mimeType) q.push(`mimeType = '${opts.mimeType}'`)
  if (opts.parent) q.push(`'${opts.parent}' in parents`)
  const params = new URLSearchParams({
    q: q.join(' and '),
    spaces: opts.space ?? 'drive',
    fields: 'files(id)',
    pageSize: '1',
  })
  const res = await ok(await fetch(`${FILES_URL}?${params}`, { headers: auth(token) }), 'list')
  const data = (await res.json()) as { files: { id: string }[] }
  return data.files[0]?.id ?? null
}

export const createFolder = async (token: string, name: string): Promise<string> => {
  const res = await ok(
    await fetch(`${FILES_URL}?fields=id`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
    }),
    'createFolder',
  )
  return ((await res.json()) as { id: string }).id
}

const parentsFor = (opts: { parent?: string; space?: DriveSpace }): string[] =>
  opts.space === 'appDataFolder' ? ['appDataFolder'] : opts.parent ? [opts.parent] : []

const buildMultipartBody = (
  metadata: Record<string, unknown>,
  contentType: string,
  content: string,
): { boundary: string; body: string } => {
  const boundary = `boundary-${crypto.randomUUID()}`
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  return { boundary, body }
}

const createContentFile = async (
  token: string,
  opts: { name: string; content: string; contentType: string; parent?: string; space?: DriveSpace },
  what: string,
): Promise<string> => {
  const metadata = { name: opts.name, parents: parentsFor(opts) }
  const { boundary, body } = buildMultipartBody(metadata, opts.contentType, opts.content)
  const res = await ok(
    await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }),
    what,
  )
  return ((await res.json()) as { id: string }).id
}

const writeContentFile = async (
  token: string,
  fileId: string,
  content: string,
  contentType: string,
  what: string,
): Promise<void> => {
  await ok(
    await fetch(`${UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': contentType },
      body: content,
    }),
    what,
  )
}

export const createJsonFile = async (
  token: string,
  opts: { name: string; data: unknown; parent?: string; space?: DriveSpace },
): Promise<string> =>
  createContentFile(
    token,
    { ...opts, content: JSON.stringify(opts.data), contentType: 'application/json' },
    'createJsonFile',
  )

export const readJsonFile = async <T>(token: string, fileId: string): Promise<T> => {
  const res = await ok(
    await fetch(`${FILES_URL}/${fileId}?alt=media`, { headers: auth(token) }),
    'read',
  )
  return (await res.json()) as T
}

export const writeJsonFile = async (token: string, fileId: string, data: unknown): Promise<void> =>
  writeContentFile(token, fileId, JSON.stringify(data), 'application/json', 'write')

export const createTextFile = async (
  token: string,
  opts: { name: string; content: string; mimeType: string; parent?: string; space?: DriveSpace },
): Promise<string> =>
  createContentFile(token, { ...opts, contentType: opts.mimeType }, 'createTextFile')

export const writeTextFile = async (
  token: string,
  fileId: string,
  content: string,
  mimeType: string,
): Promise<void> => writeContentFile(token, fileId, content, mimeType, 'writeText')

export const readTextFile = async (token: string, fileId: string): Promise<string> => {
  const res = await ok(
    await fetch(`${FILES_URL}/${fileId}?alt=media`, { headers: auth(token) }),
    'readText',
  )
  return res.text()
}

export const deleteFile = async (token: string, fileId: string): Promise<void> => {
  await ok(
    await fetch(`${FILES_URL}/${fileId}`, { method: 'DELETE', headers: auth(token) }),
    'delete',
  )
}

export interface DriveFileListing {
  id: string
  name: string
  modifiedTime: string
}

export const listFiles = async (
  token: string,
  opts: { parent?: string; space?: DriveSpace },
): Promise<DriveFileListing[]> => {
  const q = ['trashed = false']
  if (opts.parent) q.push(`'${opts.parent}' in parents`)
  const files: DriveFileListing[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: q.join(' and '),
      spaces: opts.space ?? 'drive',
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageSize: '1000',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await ok(await fetch(`${FILES_URL}?${params}`, { headers: auth(token) }), 'list')
    const data = (await res.json()) as { files: DriveFileListing[]; nextPageToken?: string }
    files.push(...data.files)
    pageToken = data.nextPageToken
  } while (pageToken)
  return files
}

export const upsertJsonFile = async (
  token: string,
  opts: { name: string; data: unknown; parent?: string; space?: DriveSpace },
): Promise<string> => {
  const existing = await findFile(token, {
    name: opts.name,
    parent: opts.parent,
    space: opts.space,
  })
  if (existing) {
    await writeJsonFile(token, existing, opts.data)
    return existing
  }
  return createJsonFile(token, opts)
}

export const upsertTextFile = async (
  token: string,
  opts: { name: string; content: string; mimeType: string; parent?: string; space?: DriveSpace },
): Promise<string> => {
  const existing = await findFile(token, {
    name: opts.name,
    parent: opts.parent,
    space: opts.space,
  })
  if (existing) {
    await writeTextFile(token, existing, opts.content, opts.mimeType)
    return existing
  }
  return createTextFile(token, opts)
}
