# Design — Google login + Drive bootstrap

Date: 2026-06-25 · Status: approved (pre-implementation)
Schema impact: none (no `SCHEMA_VERSION` bump). Touches `specs.md` §4, §10, §11.

## Goal

Let the user sign in with Google and, on first login, provision their own Drive
storage: an idempotent bootstrap that ensures the `Moneta` folder, the data files
(`movimientos.json`, `activos.json`) and the seed config (`config.json` in the
hidden `appDataFolder`) exist. No own backend; identity is Google; data lives in
the user's Drive.

## Scope

**In:** Google login (GIS token model, public client, no secret), access-token
acquisition for Drive, user identity for display/local keying, and the idempotent
Drive bootstrap.

**Out (their own specs later):** PIN lock (`pinLock.ts`) and the real CRUD of
movements/assets (`repo.ts`).

## Decisions baked in (also logged in `specs.md` §11)

- **Data format:** JSON files now (`movimientos.json`, `activos.json`); Google
  Sheets is a possible future export, not v1. JSON maps 1:1 to `schema.ts`, needs
  only the Drive Files API under `drive.file`, and keeps money-parsing logic out
  of fragile cell/range conversions.
- **Identity:** obtained via `GET drive/v3/about?fields=user` with the same access
  token (email + displayName), avoiding a second consent flow. Slight deviation
  from §5's literal "ID token `sub`"; acceptable for v1.
- **Token lifetime (this stage):** access token lives **in memory only** — no
  `localStorage`, no unencrypted IndexedDB (honors §7). Silent re-auth while the
  Google session is alive. Encrypted caching arrives with `pinLock.ts`.
- **Config location:** `appDataFolder` by default, but the location is abstracted
  behind a single repo function so a future "store config in the visible folder"
  toggle is a small change. No toggle UI in v1 (YAGNI).

## Modules

Each unit has one purpose, a defined interface, and is testable in isolation.

| File                             | Responsibility                                                                                                                                    | Depends on                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `src/lib/auth.ts`                | Wrap GIS: request a Drive access token (token model, no secret), expose identity, silent re-auth.                                                 | GIS `google.accounts.oauth2` |
| `src/lib/drive.ts`               | Drive v3 REST primitives over `fetch`: find/create folder, find/create/read/write JSON file, `appDataFolder` support.                             | `auth` (token)               |
| `src/lib/bootstrap.ts`           | Orchestrate: ensure `Moneta` folder → ensure `movimientos.json`/`activos.json` (`[]`) → ensure `config.json` (from `CONFIG_SEMILLA`). Idempotent. | `drive`                      |
| `src/lib/authStore.ts` (zustand) | State: `status`, `user`, `accessToken` (memory), Drive ids (folder + files).                                                                      | `auth`, `bootstrap`          |
| `src/features/auth/`             | Login screen + route guard (`/` redirects to login when unauthenticated).                                                                         | `authStore`                  |

`drive.ts` is the foundation `repo.ts` will reuse.

## Data flow

1. App opens → guard sees `status !== 'authenticated'` → shows login.
2. "Sign in with Google" → `auth.ts` requests a token with scopes
   `drive.file` + `drive.appdata`.
3. With the token, `bootstrap.ts` runs, **find-before-create** (with `drive.file`
   we only see what the app created):
   - Visible `Moneta` folder → `movimientos.json`, `activos.json`.
   - `appDataFolder` → `config.json` (seeded from `CONFIG_SEMILLA` if missing).
4. `authStore` keeps identity + Drive ids; guard lets the user into `/`.

## Auth detail

GIS token model returns an **access token, not an ID token**. To avoid a second
consent, identity comes from `GET drive/v3/about?fields=user` (email + name; no
extra scope). Used as the per-account local key.

## Error handling

- GIS script fails to load → error state with retry.
- User cancels / denies consent → error state, retry.
- Token expires → silent re-request; if it fails → back to login.
- Drive `401` → re-auth; `403` quota → surfaced error.
- Offline on first launch → bootstrap needs the network the first time; inform the
  user. (Later launches run from the IndexedDB cache.)
- Re-running bootstrap never duplicates (find-before-create).

## Testing

TDD for `auth.ts` (per CLAUDE.md). Mock GIS + `fetch`.

- `auth.ts`: token acquisition, cancel/deny, expiry/re-auth.
- `drive.ts`: correct query/body construction, JSON read/write, `appDataFolder`
  `spaces`.
- `bootstrap.ts`: creates when missing, reuses when present (idempotency), seeds
  config from `CONFIG_SEMILLA`.

## Done when

- A new Google account can log in and ends with a `Moneta` folder containing
  `movimientos.json` + `activos.json` and a `config.json` in `appDataFolder`.
- Logging in again reuses the existing folder/files (no duplicates).
- Access token is never persisted to `localStorage` or unencrypted storage.
- Guard blocks `/` until authenticated; identity (email/name) is available.
- `auth.ts`, `drive.ts`, `bootstrap.ts` tests pass; `typecheck` + `lint` green.
