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

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new DriveError(`${what} ${res.status}`)
  return res
}

export async function findFile(
  token: string,
  opts: { name: string; mimeType?: string; parent?: string; space?: DriveSpace },
): Promise<string | null> {
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

export async function createFolder(token: string, name: string): Promise<string> {
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

export async function createJsonFile(
  token: string,
  opts: { name: string; data: unknown; parent?: string; space?: DriveSpace },
): Promise<string> {
  const parents =
    opts.space === 'appDataFolder' ? ['appDataFolder'] : opts.parent ? [opts.parent] : []
  const metadata = { name: opts.name, parents }
  const boundary = `moneta-${crypto.randomUUID()}`
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(opts.data)}\r\n` +
    `--${boundary}--`
  const res = await ok(
    await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }),
    'createJsonFile',
  )
  return ((await res.json()) as { id: string }).id
}

export async function readJsonFile<T>(token: string, fileId: string): Promise<T> {
  const res = await ok(
    await fetch(`${FILES_URL}/${fileId}?alt=media`, { headers: auth(token) }),
    'read',
  )
  return (await res.json()) as T
}

export async function writeJsonFile(token: string, fileId: string, data: unknown): Promise<void> {
  await ok(
    await fetch(`${UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    'write',
  )
}
