import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  findFile,
  createFolder,
  createJsonFile,
  readJsonFile,
  writeJsonFile,
  deleteFile,
  listFiles,
  upsertJsonFile,
  createTextFile,
  writeTextFile,
  readTextFile,
  upsertTextFile,
  getLastKnownServerTime,
  DriveError,
} from '@/lib/drive'

const jsonResponse = (body: unknown, status = 200): Response => {
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
      name: 'KuroBello',
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
    const id = await createFolder('tok', 'KuroBello')
    expect(id).toBe('new')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/drive/v3/files?fields=id')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ name: 'KuroBello', mimeType: 'application/vnd.google-apps.folder' })
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

describe('deleteFile', () => {
  it('DELETEs by id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await deleteFile('tok', 'f1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/f1')
    expect((init as RequestInit).method).toBe('DELETE')
  })
})

describe('listFiles', () => {
  it('lists id/name/modifiedTime, scoped to a parent + space', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          { id: 'f1', name: 'mov-dev1-2026-08.json', modifiedTime: '2026-08-01T00:00:00.000Z' },
        ],
      }),
    )
    const files = await listFiles('tok', { parent: 'fold', space: 'drive' })
    expect(files).toEqual([
      { id: 'f1', name: 'mov-dev1-2026-08.json', modifiedTime: '2026-08-01T00:00:00.000Z' },
    ])
    const u = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(u.searchParams.get('q')).toBe("trashed = false and 'fold' in parents")
    expect(u.searchParams.get('spaces')).toBe('drive')
  })

  it('follows nextPageToken until exhausted, never truncating a large folder', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          files: [{ id: 'f1', name: 'a.json', modifiedTime: 't1' }],
          nextPageToken: 'p2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ files: [{ id: 'f2', name: 'b.json', modifiedTime: 't2' }] }),
      )

    const files = await listFiles('tok', { parent: 'fold' })

    expect(files.map((f) => f.id)).toEqual(['f1', 'f2'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondUrl = new URL(fetchMock.mock.calls[1]![0] as string)
    expect(secondUrl.searchParams.get('pageToken')).toBe('p2')
  })
})

describe('upsertJsonFile', () => {
  it('writes to the existing file when found, never creating a duplicate', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'existing' }] })) // findFile
      .mockResolvedValueOnce(jsonResponse({ id: 'existing' })) // writeJsonFile

    const id = await upsertJsonFile('tok', {
      name: 'act-dev1.json',
      data: { v: 1 },
      parent: 'fold',
    })

    expect(id).toBe('existing')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![0]).toContain('/existing?uploadType=media')
  })

  it('creates the file when none exists', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [] })) // findFile: nothing
      .mockResolvedValueOnce(jsonResponse({ id: 'new' })) // createJsonFile

    const id = await upsertJsonFile('tok', {
      name: 'act-dev1.json',
      data: { v: 1 },
      parent: 'fold',
    })

    expect(id).toBe('new')
    expect(fetchMock.mock.calls[1]![0]).toContain('uploadType=multipart')
  })
})

describe('text files', () => {
  it('createTextFile sends the raw content, not JSON-stringified', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'leeme' }))
    const id = await createTextFile('tok', {
      name: 'LEEME.txt',
      content: 'Hola, esto es tuyo.',
      mimeType: 'text/plain; charset=utf-8',
      parent: 'fold',
    })
    expect(id).toBe('leeme')
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    expect(body).toContain('Hola, esto es tuyo.')
    expect(body).not.toContain('"Hola, esto es tuyo."') // never JSON-quoted
    expect(body).toContain('Content-Type: text/plain; charset=utf-8')
  })

  it('writeTextFile PATCHes the raw content with the given mime type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'f1' }))
    await writeTextFile('tok', 'f1', 'a;b;c', 'text/csv;charset=utf-8')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=media')
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'text/csv;charset=utf-8',
    })
    expect((init as RequestInit).body).toBe('a;b;c')
  })

  it('readTextFile GETs media as text, not JSON-parsed', async () => {
    fetchMock.mockResolvedValueOnce(new Response('a;b;c', { status: 200 }))
    await expect(readTextFile('tok', 'f1')).resolves.toBe('a;b;c')
  })

  it('upsertTextFile writes to an existing file, or creates one if none exists', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'existing' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'existing' }))
    const id = await upsertTextFile('tok', {
      name: 'LEEME.txt',
      content: 'v2',
      mimeType: 'text/plain',
      parent: 'fold',
    })
    expect(id).toBe('existing')
  })
})

describe('getLastKnownServerTime', () => {
  it('captures the Date header from any response, success or failure', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'x' }), {
        status: 200,
        headers: { date: 'Thu, 20 Aug 2026 04:00:00 GMT' },
      }),
    )
    await createFolder('tok', 'X')
    expect(getLastKnownServerTime()).toBe(Date.parse('Thu, 20 Aug 2026 04:00:00 GMT'))

    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 403, headers: { date: 'Thu, 20 Aug 2026 05:00:00 GMT' } }),
    )
    await expect(createFolder('tok', 'X')).rejects.toBeInstanceOf(DriveError)
    expect(getLastKnownServerTime()).toBe(Date.parse('Thu, 20 Aug 2026 05:00:00 GMT'))
  })
})

describe('errors', () => {
  it('throws DriveError on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }))
    await expect(createFolder('tok', 'X')).rejects.toBeInstanceOf(DriveError)
  })
})
