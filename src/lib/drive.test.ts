import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  findFile,
  createFolder,
  createJsonFile,
  readJsonFile,
  writeJsonFile,
  DriveError,
} from '@/lib/drive'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('findFile', () => {
  it('queries by name + parent in the drive space and returns the first id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'f1' }] }))
    const id = await findFile('tok', { name: 'movimientos.json', parent: 'fold' })
    expect(id).toBe('f1')
    const [url, init] = fetchMock.mock.calls[0]!
    const u = new URL(url as string)
    expect(u.origin + u.pathname).toBe('https://www.googleapis.com/drive/v3/files')
    expect(u.searchParams.get('q')).toBe(
      "name = 'movimientos.json' and trashed = false and 'fold' in parents",
    )
    expect(u.searchParams.get('spaces')).toBe('drive')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('uses the appDataFolder space and folder mimeType filter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] }))
    const id = await findFile('tok', {
      name: 'Moneta',
      mimeType: 'application/vnd.google-apps.folder',
      space: 'appDataFolder',
    })
    expect(id).toBeNull()
    const u = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(u.searchParams.get('spaces')).toBe('appDataFolder')
    expect(u.searchParams.get('q')).toContain("mimeType = 'application/vnd.google-apps.folder'")
  })
})

describe('createFolder', () => {
  it('POSTs folder metadata and returns the new id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'new' }))
    const id = await createFolder('tok', 'Moneta')
    expect(id).toBe('new')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/drive/v3/files?fields=id')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ name: 'Moneta', mimeType: 'application/vnd.google-apps.folder' })
  })
})

describe('createJsonFile', () => {
  it('multipart-uploads to a parent folder and returns the id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'jf' }))
    const id = await createJsonFile('tok', { name: 'activos.json', data: [], parent: 'fold' })
    expect(id).toBe('jf')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    )
    const ct = (init as RequestInit).headers as Record<string, string>
    expect(ct['Content-Type']).toMatch(/^multipart\/related; boundary=/)
    const body = (init as RequestInit).body as string
    expect(body).toContain('"name":"activos.json"')
    expect(body).toContain('"parents":["fold"]')
  })

  it('targets appDataFolder when space is appDataFolder', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'cfg' }))
    await createJsonFile('tok', { name: 'config.json', data: {}, space: 'appDataFolder' })
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    expect(body).toContain('"parents":["appDataFolder"]')
  })
})

describe('readJsonFile', () => {
  it('GETs media and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'x' }]))
    const data = await readJsonFile<{ id: string }[]>('tok', 'f1')
    expect(data).toEqual([{ id: 'x' }])
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://www.googleapis.com/drive/v3/files/f1?alt=media',
    )
  })
})

describe('writeJsonFile', () => {
  it('PATCHes media with a JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'f1' }))
    await writeJsonFile('tok', 'f1', [{ id: 'x' }])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=media')
    expect((init as RequestInit).method).toBe('PATCH')
    expect((init as RequestInit).body).toBe('[{"id":"x"}]')
  })
})

describe('errors', () => {
  it('throws DriveError on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }))
    await expect(createFolder('tok', 'X')).rejects.toBeInstanceOf(DriveError)
  })
})
