# Google Login + Drive Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user sign in with Google and, on first login, idempotently provision their own Drive storage (a `Moneta` folder with `movimientos.json` + `activos.json`, plus `config.json` seeded in `appDataFolder`).

**Architecture:** Five focused units. `auth.ts` wraps Google Identity Services (token model, no secret) and reads identity from the Drive `about` endpoint. `drive.ts` is thin REST-over-`fetch` primitives. `bootstrap.ts` orchestrates find-before-create. `authStore.ts` (zustand, **in-memory only**) holds session + Drive ids. `features/auth/` is the login screen + route guard.

**Tech Stack:** React 19 + Vite + TypeScript (strict), zustand, Vitest + Testing Library + user-event, Google Identity Services, Drive REST v3.

## Global Constraints

- **TypeScript strict**, `verbatimModuleSyntax` (use `import type` for type-only imports), `erasableSyntaxOnly` (no `enum`/`namespace`/param-properties — use `const` objects + unions), `noUncheckedIndexedAccess` (indexed access is `T | undefined`).
- **Everything in English** (code, identifiers, comments, commit messages). Exception: `schema.ts` domain terms (`Movimiento`, `seccion`, `monto`…) stay Spanish.
- **Import types from `@/lib/schema`**, never redefine. Use `CONFIG_SEMILLA` for seeding.
- **OAuth scopes are EXACTLY** `https://www.googleapis.com/auth/drive.file` + `https://www.googleapis.com/auth/drive.appdata`. Never escalate to `drive` or `drive.readonly`.
- **Access token lives in memory only.** No `localStorage`/`sessionStorage`, no unencrypted IndexedDB, no zustand `persist`. Never log the token.
- **Client ID** from `import.meta.env.VITE_GOOGLE_CLIENT_ID` (public, not a secret). Fail loudly if missing.
- Use the `@/` import alias for everything under `src`.
- Interactions in tests use `@testing-library/user-event`, never `fireEvent`.
- TDD is mandatory for `auth.ts` (per CLAUDE.md); applied to every unit here.

---

### Task 1: `auth.ts` — Google token + identity

**Files:**

- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`
- Modify: `package.json` (add dev dep `@types/google.accounts`), `tsconfig.app.json` (add `"google.accounts"` to `types`)

**Interfaces:**

- Consumes: `import.meta.env.VITE_GOOGLE_CLIENT_ID`; global `google.accounts.oauth2` (GIS).
- Produces:
  - `class AuthError extends Error` (never carries the token)
  - `type AuthSession = { accessToken: string; expiresAt: number }`
  - `type GoogleUser = { email: string; name: string; photoLink?: string }`
  - `loadGis(): Promise<void>`
  - `requestAccessToken(prompt?: '' | 'consent'): Promise<AuthSession>`
  - `fetchGoogleUser(accessToken: string): Promise<GoogleUser>`
  - `const DRIVE_SCOPES: string`

- [ ] **Step 1: Install GIS types and wire tsconfig**

Run:

```bash
bun add -d @types/google.accounts
```

Then edit `tsconfig.app.json`: change `"types": ["vite/client"]` to `"types": ["vite/client", "google.accounts"]`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestAccessToken, fetchGoogleUser, AuthError, DRIVE_SCOPES } from '@/lib/auth'

type Cb = (resp: { access_token?: string; expires_in?: number; error?: string }) => void
type ErrCb = (err: { type: string }) => void

let lastInit: { scope: string; callback: Cb; error_callback?: ErrCb } | null = null

beforeEach(() => {
  lastInit = null
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com')
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: { scope: string; callback: Cb; error_callback?: ErrCb }) => {
          lastInit = cfg
          return { requestAccessToken: vi.fn() }
        },
      },
    },
  })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-25T00:00:00Z'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('requestAccessToken', () => {
  it('requests only the drive.file + drive.appdata scopes', async () => {
    const p = requestAccessToken('consent')
    lastInit!.callback({ access_token: 'tok', expires_in: 3600 })
    await p
    expect(DRIVE_SCOPES).toBe(
      'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
    )
    expect(lastInit!.scope).toBe(DRIVE_SCOPES)
  })

  it('resolves with the token and a computed expiry', async () => {
    const p = requestAccessToken('')
    lastInit!.callback({ access_token: 'tok', expires_in: 3600 })
    const session = await p
    expect(session.accessToken).toBe('tok')
    expect(session.expiresAt).toBe(Date.parse('2026-06-25T00:00:00Z') + 3600 * 1000)
  })

  it('rejects with AuthError when the response carries an error', async () => {
    const p = requestAccessToken('')
    lastInit!.callback({ error: 'access_denied' })
    await expect(p).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects with AuthError when the user cancels (error_callback)', async () => {
    const p = requestAccessToken('')
    lastInit!.error_callback!({ type: 'popup_closed' })
    await expect(p).rejects.toBeInstanceOf(AuthError)
  })
})

describe('fetchGoogleUser', () => {
  it('reads identity from drive/v3/about with a Bearer token', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ user: { emailAddress: 'a@b.com', displayName: 'Ana', photoLink: 'p' } }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = await fetchGoogleUser('tok')
    expect(user).toEqual({ email: 'a@b.com', name: 'Ana', photoLink: 'p' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://www.googleapis.com/drive/v3/about?fields=user')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('throws AuthError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )
    await expect(fetchGoogleUser('tok')).rejects.toBeInstanceOf(AuthError)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test -- src/lib/auth.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/auth.ts`:

```ts
export const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user'

export class AuthError extends Error {
  constructor(reason: string) {
    super(`auth: ${reason}`)
    this.name = 'AuthError'
  }
}

export type AuthSession = { accessToken: string; expiresAt: number }
export type GoogleUser = { email: string; name: string; photoLink?: string }

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!id) throw new AuthError('missing VITE_GOOGLE_CLIENT_ID')
  return id
}

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new AuthError('GIS failed to load')), {
        once: true,
      })
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new AuthError('GIS failed to load'))
    document.head.appendChild(script)
  })
}

export async function requestAccessToken(prompt: '' | 'consent' = ''): Promise<AuthSession> {
  await loadGis()
  return new Promise<AuthSession>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: DRIVE_SCOPES,
      callback: (resp) => {
        if (resp.error) {
          reject(new AuthError(resp.error))
          return
        }
        resolve({ accessToken: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 })
      },
      error_callback: (err) => reject(new AuthError(err.type)),
    })
    client.requestAccessToken({ prompt })
  })
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch(ABOUT_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new AuthError(`about ${res.status}`)
  const data = (await res.json()) as {
    user: { emailAddress: string; displayName: string; photoLink?: string }
  }
  return {
    email: data.user.emailAddress,
    name: data.user.displayName,
    photoLink: data.user.photoLink,
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test -- src/lib/auth.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts package.json bun.lock tsconfig.app.json
git commit -m "feat(auth): GIS token client + Drive identity"
```

---

### Task 2: `drive.ts` — Drive REST primitives

**Files:**

- Create: `src/lib/drive.ts`
- Test: `src/lib/drive.test.ts`

**Interfaces:**

- Consumes: global `fetch`; `crypto.randomUUID()`.
- Produces:
  - `class DriveError extends Error`
  - `type DriveSpace = 'drive' | 'appDataFolder'`
  - `findFile(token: string, opts: { name: string; mimeType?: string; parent?: string; space?: DriveSpace }): Promise<string | null>`
  - `createFolder(token: string, name: string): Promise<string>`
  - `createJsonFile(token: string, opts: { name: string; data: unknown; parent?: string; space?: DriveSpace }): Promise<string>`
  - `readJsonFile<T>(token: string, fileId: string): Promise<T>`
  - `writeJsonFile(token: string, fileId: string, data: unknown): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/drive.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- src/lib/drive.test.ts`
Expected: FAIL — cannot resolve `@/lib/drive`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/drive.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- src/lib/drive.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
bun run typecheck
git add src/lib/drive.ts src/lib/drive.test.ts
git commit -m "feat(drive): REST primitives for folders and JSON files"
```

---

### Task 3: `bootstrap.ts` — idempotent provisioning

**Files:**

- Create: `src/lib/bootstrap.ts`
- Test: `src/lib/bootstrap.test.ts`

**Interfaces:**

- Consumes: `findFile`, `createFolder`, `createJsonFile` from `@/lib/drive`; `CONFIG_SEMILLA` from `@/lib/schema`.
- Produces:
  - `type DriveLayout = { folderId: string; movimientosFileId: string; activosFileId: string; configFileId: string }`
  - `bootstrap(token: string): Promise<DriveLayout>`
  - `const FOLDER_NAME = 'Moneta'`, `MOVIMIENTOS_FILE = 'movimientos.json'`, `ACTIVOS_FILE = 'activos.json'`, `CONFIG_FILE = 'config.json'`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bootstrap.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bootstrap } from '@/lib/bootstrap'
import { CONFIG_SEMILLA } from '@/lib/schema'

vi.mock('@/lib/drive', () => ({
  findFile: vi.fn(),
  createFolder: vi.fn(),
  createJsonFile: vi.fn(),
}))
import { findFile, createFolder, createJsonFile } from '@/lib/drive'

const mFind = vi.mocked(findFile)
const mCreateFolder = vi.mocked(createFolder)
const mCreateJson = vi.mocked(createJsonFile)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('bootstrap', () => {
  it('creates folder, data files and seeded config when nothing exists', async () => {
    mFind.mockResolvedValue(null)
    mCreateFolder.mockResolvedValue('FOLD')
    mCreateJson
      .mockResolvedValueOnce('MOV')
      .mockResolvedValueOnce('ACT')
      .mockResolvedValueOnce('CFG')

    const layout = await bootstrap('tok')

    expect(layout).toEqual({
      folderId: 'FOLD',
      movimientosFileId: 'MOV',
      activosFileId: 'ACT',
      configFileId: 'CFG',
    })
    expect(mCreateFolder).toHaveBeenCalledWith('tok', 'Moneta')
    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'movimientos.json',
      data: [],
      parent: 'FOLD',
    })
    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'activos.json',
      data: [],
      parent: 'FOLD',
    })
    expect(mCreateJson).toHaveBeenCalledWith('tok', {
      name: 'config.json',
      data: CONFIG_SEMILLA,
      space: 'appDataFolder',
    })
  })

  it('is idempotent: reuses existing folder and files, creating nothing', async () => {
    mFind
      .mockResolvedValueOnce('FOLD') // folder
      .mockResolvedValueOnce('MOV') // movimientos
      .mockResolvedValueOnce('ACT') // activos
      .mockResolvedValueOnce('CFG') // config

    const layout = await bootstrap('tok')

    expect(layout).toEqual({
      folderId: 'FOLD',
      movimientosFileId: 'MOV',
      activosFileId: 'ACT',
      configFileId: 'CFG',
    })
    expect(mCreateFolder).not.toHaveBeenCalled()
    expect(mCreateJson).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- src/lib/bootstrap.test.ts`
Expected: FAIL — cannot resolve `@/lib/bootstrap`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bootstrap.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- src/lib/bootstrap.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
bun run typecheck
git add src/lib/bootstrap.ts src/lib/bootstrap.test.ts
git commit -m "feat(bootstrap): idempotent Drive provisioning"
```

---

### Task 4: `authStore.ts` — zustand session state (in-memory)

**Files:**

- Create: `src/lib/authStore.ts`
- Test: `src/lib/authStore.test.ts`

**Interfaces:**

- Consumes: `requestAccessToken`, `fetchGoogleUser`, `type AuthSession`, `type GoogleUser` from `@/lib/auth`; `bootstrap`, `type DriveLayout` from `@/lib/bootstrap`.
- Produces:
  - `type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error'`
  - `useAuthStore` (zustand hook) with state `{ status, user, session, drive, error }` and actions `login(): Promise<void>`, `restore(): Promise<void>`, `logout(): void`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/authStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requestAccessToken: vi.fn(),
  fetchGoogleUser: vi.fn(),
}))
vi.mock('@/lib/bootstrap', () => ({ bootstrap: vi.fn() }))

import { requestAccessToken, fetchGoogleUser } from '@/lib/auth'
import { bootstrap } from '@/lib/bootstrap'
import { useAuthStore } from '@/lib/authStore'

const mToken = vi.mocked(requestAccessToken)
const mUser = vi.mocked(fetchGoogleUser)
const mBootstrap = vi.mocked(bootstrap)

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ status: 'idle', user: null, session: null, drive: null, error: null })
})

describe('useAuthStore.login', () => {
  it('transitions to authenticated with user, session and drive layout', async () => {
    mToken.mockResolvedValue({ accessToken: 'tok', expiresAt: 1 })
    mUser.mockResolvedValue({ email: 'a@b.com', name: 'Ana' })
    mBootstrap.mockResolvedValue({
      folderId: 'F',
      movimientosFileId: 'M',
      activosFileId: 'A',
      configFileId: 'C',
    })

    await useAuthStore.getState().login()

    const s = useAuthStore.getState()
    expect(s.status).toBe('authenticated')
    expect(s.user).toEqual({ email: 'a@b.com', name: 'Ana' })
    expect(s.session?.accessToken).toBe('tok')
    expect(s.drive?.folderId).toBe('F')
    expect(mToken).toHaveBeenCalledWith('consent')
  })

  it('transitions to error and keeps no token when auth fails', async () => {
    mToken.mockRejectedValue(new Error('access: access_denied'))

    await useAuthStore.getState().login()

    const s = useAuthStore.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('access: access_denied')
    expect(s.session).toBeNull()
  })
})

describe('useAuthStore.restore', () => {
  it('silently authenticates with prompt "" and falls back to idle on failure', async () => {
    mToken.mockRejectedValue(new Error('access: no session'))
    await useAuthStore.getState().restore()
    expect(mToken).toHaveBeenCalledWith('')
    expect(useAuthStore.getState().status).toBe('idle')
  })
})

describe('useAuthStore.logout', () => {
  it('clears all session state', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { email: 'a@b.com', name: 'Ana' },
      session: { accessToken: 'tok', expiresAt: 1 },
      drive: { folderId: 'F', movimientosFileId: 'M', activosFileId: 'A', configFileId: 'C' },
      error: null,
    })
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s).toMatchObject({ status: 'idle', user: null, session: null, drive: null })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- src/lib/authStore.test.ts`
Expected: FAIL — cannot resolve `@/lib/authStore`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/authStore.ts`:

```ts
import { create } from 'zustand'
import { requestAccessToken, fetchGoogleUser, type AuthSession, type GoogleUser } from '@/lib/auth'
import { bootstrap, type DriveLayout } from '@/lib/bootstrap'

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error'

type AuthState = {
  status: AuthStatus
  user: GoogleUser | null
  session: AuthSession | null
  drive: DriveLayout | null
  error: string | null
  login: () => Promise<void>
  restore: () => Promise<void>
  logout: () => void
}

async function authenticate(prompt: '' | 'consent') {
  const session = await requestAccessToken(prompt)
  const [user, drive] = await Promise.all([
    fetchGoogleUser(session.accessToken),
    bootstrap(session.accessToken),
  ])
  return { session, user, drive }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  session: null,
  drive: null,
  error: null,
  login: async () => {
    set({ status: 'authenticating', error: null })
    try {
      const { session, user, drive } = await authenticate('consent')
      set({ status: 'authenticated', session, user, drive })
    } catch (e) {
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  restore: async () => {
    try {
      const { session, user, drive } = await authenticate('')
      set({ status: 'authenticated', session, user, drive })
    } catch {
      set({ status: 'idle' })
    }
  },
  logout: () => set({ status: 'idle', user: null, session: null, drive: null, error: null }),
}))

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- src/lib/authStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
bun run typecheck
git add src/lib/authStore.ts src/lib/authStore.test.ts
git commit -m "feat(auth): in-memory zustand session store"
```

---

### Task 5: `features/auth` — login screen + route guard

**Files:**

- Create: `src/features/auth/LoginScreen.tsx`
- Create: `src/features/auth/RequireAuth.tsx`
- Create: `src/features/auth/RequireAuth.test.tsx`
- Modify: `src/router.tsx`

**Interfaces:**

- Consumes: `useAuthStore` from `@/lib/authStore`; `Button` from `@/components/ui` (if present) else a native `<button>`.
- Produces:
  - `LoginScreen` (default-free named export) — renders sign-in CTA, calls `useAuthStore().login`, shows `authenticating`/`error` states.
  - `RequireAuth({ children }: { children: React.ReactNode })` — renders `children` only when `status === 'authenticated'`, otherwise `<LoginScreen />`.

- [ ] **Step 1: Check for a shadcn Button**

Run: `ls src/components/ui 2>/dev/null`
If `button.tsx` exists, import `{ Button } from '@/components/ui/button'`. Otherwise use a native `<button>` with Tailwind classes (the test below relies only on the accessible role/name, so either works). The code below assumes the native fallback; swap to `Button` if available.

- [ ] **Step 2: Write the failing test**

Create `src/features/auth/RequireAuth.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuthStore } from '@/lib/authStore'

beforeEach(() => {
  useAuthStore.setState({ status: 'idle', user: null, session: null, drive: null, error: null })
})

describe('RequireAuth', () => {
  it('shows the login screen when unauthenticated', () => {
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    useAuthStore.setState({ status: 'authenticated' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('calls login when the button is clicked', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    await userEvent.click(screen.getByRole('button', { name: /google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  it('shows an error message when status is error', () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test -- src/features/auth/RequireAuth.test.tsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 4: Implement `LoginScreen`**

Create `src/features/auth/LoginScreen.tsx`:

```tsx
import { useAuthStore } from '@/lib/authStore'

export function LoginScreen() {
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const busy = status === 'authenticating'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Moneta</h1>
        <p className="text-muted-foreground text-sm">Tus finanzas, en tu propio Google Drive.</p>
      </div>
      <button
        type="button"
        onClick={() => void login()}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-primary-foreground disabled:opacity-60"
      >
        {busy ? 'Conectando…' : 'Entrar con Google'}
      </button>
      {status === 'error' && error ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudo iniciar sesión: {error}
        </p>
      ) : null}
    </main>
  )
}
```

- [ ] **Step 5: Implement `RequireAuth`**

Create `src/features/auth/RequireAuth.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { LoginScreen } from '@/features/auth/LoginScreen'

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  return status === 'authenticated' ? <>{children}</> : <LoginScreen />
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run test -- src/features/auth/RequireAuth.test.tsx`
Expected: PASS.

- [ ] **Step 7: Wire the guard into the router**

Edit `src/router.tsx` to wrap `Home`:

```tsx
import { createBrowserRouter } from 'react-router'
import { Home } from '@/routes/Home'
import { RequireAuth } from '@/features/auth/RequireAuth'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
])
```

- [ ] **Step 8: Full verification + commit**

Run:

```bash
bun run test
bun run typecheck
bun run lint
```

Expected: all green.

```bash
git add src/features/auth src/router.tsx
git commit -m "feat(auth): login screen + route guard"
```

---

## Notes for the implementer

- **Never** persist the access token. The zustand store has no `persist` middleware — keep it that way. Do not add logging that prints `session.accessToken`.
- The GIS script is loaded lazily by `loadGis()`; do not add a `<script>` tag to `index.html`.
- Silent re-auth (`restore`) is intentionally best-effort: failures drop to `idle`, not `error`, so the user just sees the login screen. Wiring `restore()` to run on app mount is a small follow-up (call it in `main.tsx` or an effect); left out of v1 scope to keep the guard simple — add it only if you want auto-login on refresh.
- Before running anything, ensure `.env.local` exists with a real `VITE_GOOGLE_CLIENT_ID` and that `http://localhost:5173` is an authorized JavaScript origin in the Google Cloud Console. Without it, `requestAccessToken` rejects with `AuthError('missing VITE_GOOGLE_CLIENT_ID')` or GIS errors.
