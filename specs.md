# Moneta — Specs (source of truth)

> **This file is the source of truth.** We work spec-driven: nothing gets built
> that isn't described here first. Before implementing a feature, write its spec
> in §10. After a decision is made, record it in §11. If reality and this file
> disagree, this file is wrong — fix it, don't silently diverge.

Schema version: **1** · Last updated: 2026-06-25

---

## 1. What we build

A personal-finance PWA, mobile-first. The user:

- Records **income/expenses** (flow) and **assets/investments** (balance).
- Organizes them into user-defined **sections** and **categories**
  (e.g. Personal, Trabajo, Emprendimiento → Sueldo, Impuestos, Caja menor…).
- Sees totals, per-section breakdown and charts, with history by
  day / week / month / year.
- Optionally protects the app with a **PIN**.

Audience: personal use, with the future possibility of a friend using it with
their own Google account.

## 2. Guiding principle (do not break)

**No own backend. Identity = Google. Data = in the user's own Drive.** The
developer hosts and stores no one's data or tokens. Privacy comes from the
architecture, not from infrastructure. If something "needs a server", stop and
review §6.

## 3. Stack

- **Client-side SPA:** React + Vite + TypeScript. **No SSR.**
- **PWA** via `vite-plugin-pwa` (manifest + service worker). Offline-first.
- **Routing:** React Router (`react-router` v8, data router).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`, no PostCSS) + **shadcn/ui**
  (Radix primitives, Nova preset: Geist font + Lucide icons). Components live in
  `src/components/ui`; the `cn()` helper in `src/lib/utils.ts`.
- **State:** **zustand** for shared/global state; React hooks for local state. No Redux.
- **Charts:** recharts (migrate to uPlot only if the bundle gets heavy).
- **Dates:** date-fns (modular). **Local storage:** dexie (IndexedDB).
- **IDs:** native `crypto.randomUUID()` (no `uuid` package).
- **Package manager:** bun. **Node:** 24 LTS (pinned in `.nvmrc`).
- **Tooling:** oxlint + Prettier, Vitest + Testing Library + user-event, Husky + lint-staged.
  Use `@testing-library/user-event` for interactions, never the lower-level `fireEvent`.
- **Hosting:** static (Cloudflare Pages / Netlify / GitHub Pages).

Performance comes from a small bundle + service worker caching the shell +
"IndexedDB first, Drive after" — not from SSR.

## 4. Data model

Source of truth for types: **`src/lib/schema.ts`** — import it, never redefine
the types. (Domain field names stay in Spanish: they are the real Drive
columns/contract.)

Three stores (all JSON files in the user's Drive):

- `Movimiento[]` — **flow** (in/out) → `movimientos.json` in the `Moneta` folder.
- `Activo[]` — **balance** (what you own and what it's worth today) → `activos.json`
  in the same folder.
- `Config` (sections, categories, preferences, schemaVersion) → `config.json` in
  the **appDataFolder** (syncs across devices). Location abstracted behind a single
  repo function so it could move to the visible folder later (no UI for it in v1).

Storage format is **JSON files** (1:1 with the types below, only the Drive Files
API under `drive.file`). A Google Sheets export is a possible future, not v1.

Local cache of everything in IndexedDB (disposable; re-downloaded from Drive if cleared).

**Mandatory conventions:**

- `monto` is ALWAYS positive; the sign comes from `tipo` (income adds, expense subtracts).
- `moneda` always present; UI fixes it to `"COP"` for now (field already supports multi-currency).
- `id` = app-generated uuid (not the row position).
- Dates in ISO (`yyyy-mm-dd`).
- Views are NOT stored: total, per-section breakdown and history are derived by
  grouping `Movimiento[]`.
- `schemaVersion` + `extra` = migration safety net. New fields go into `extra`
  (free JSON) first, before being promoted to a real column.

**Closed decisions:** `metodo` optional with enum `efectivo|debito|credito|banco`;
`presupuesto` exists in the schema but has no UI in v1; flow and balance are two
separate stores (do not unify).

Derived (computed, not stored): `ganancia = valorActual - (capitalInvertido ?? 0)`.

## 5. Auth & security

- Google Identity Services, **token model** (`initTokenClient`), **PKCE**,
  public client **with no client secret**.
- **Scopes:** `drive.file` (per-file, non-sensitive) + `drive.appdata`. If an
  existing file must be opened, use the Google Picker together with `drive.file`.
- Identity = the user's Google account, read from `GET drive/v3/about?fields=user`
  (email + displayName) with the same access token — no second consent, no ID-token
  flow in v1. No users table.
- **Bootstrap:** on first login, find the `Moneta` folder in Drive (via `drive.file`);
  if it doesn't exist, create it. Ensure `movimientos.json` + `activos.json` exist
  in it (`[]`), and `config.json` (seeded from `CONFIG_SEMILLA`) in `appDataFolder`.
  Idempotent (find-before-create). Access token kept in memory only until `pinLock.ts`
  adds encrypted caching.
- **Access-token-only** (no stored refresh token). Silent re-auth while the
  Google session is alive.
- **PIN lock** (`pinLock.ts`): local, per-device. With WebCrypto: derive a key
  from the PIN (PBKDF2/Argon2) and encrypt the cached token in IndexedDB. Never
  store the PIN in plaintext. PIN reset = re-login with Google (no email flows).
  Throttle after ~5 attempts → force re-login.
- The PIN protects against casual access (someone holding the unlocked phone),
  it is not a forensic cryptographic barrier. The real data lives in Drive behind
  Google auth.

## 6. No backend — and when it would be justified

No backend now. A minimal serverless piece (Cloud Function / Apps Script /
Cloudflare Worker) is only justified if one of these appears:

- Background actions (scheduled reminders that write while the user is away →
  needs a server-side refresh token).
- Cross-user features (ranking, shared budgets → breaks the privacy model, evaluate carefully).
- Hiding a third-party API key (LLM auto-categorization, bank sync).

Do not add a backend unless one of those explicitly requires it.

## 7. ⚠️ Critical guardrails

- `.env` in `.gitignore` from the first commit. Never commit credentials. If one
  leaks, **rotate it** (invalidate in Google) — deleting the file is not enough,
  it stays in git history.
- The Google **Client ID is public** (it ships in the frontend, that's normal).
  The real protection is the authorized-origins list in Google Cloud Console:
  restrict it to our own domain.
- **Do not escalate scopes.** Only `drive.file` + `drive.appdata`. Never the full
  `drive` scope nor `drive.readonly` (restricted → trigger the expensive, slow CASA audit).
- Repo private for now. If made public: enable secret scanning + push protection
  and review history first.
- Do not use `localStorage`/`sessionStorage` for sensitive data. Use IndexedDB;
  the token is stored encrypted (key derived from the PIN).
- Respect the `schema.ts` contract. Structural changes bump `schemaVersion` and
  require an idempotent migration + a backup of the JSON data files before running it.

## 8. Build order (scaffold → features)

1. ✅ Vite + React + TS scaffold.
2. ✅ `vite-plugin-pwa` (manifest + service worker).
3. ✅ Correct `.gitignore` (node_modules, dist, `.env*`).
4. ✅ `schema.ts` as source of truth.
5. ⬜ Independent pieces (any order):
   - `auth.ts` (GIS token client) + Drive bootstrap (`drive.ts` + `bootstrap.ts`)
     — see §10.1.
   - `pinLock.ts` (WebCrypto) — its own spec.
   - `repo.ts` (CRUD of movements/assets in the JSON data files; load/save Config
     in appDataFolder; IndexedDB cache; schemaVersion check on startup) — its own spec.

## 9. How we work

Design/architecture decisions are resolved **before** coding, not improvised
between commands. If a decision gets stuck or something not covered here appears,
**stop** and resolve it cold instead of choosing on the fly. Record the outcome
in §11.

## 10. Feature specs

> One subsection per feature, written before implementation. Template:
> **Goal · User story · UI · Data touched · Edge cases · Done when.**

### 10.1 Google login + Drive bootstrap

Full design: `docs/superpowers/specs/2026-06-25-auth-drive-bootstrap-design.md`.

- **Goal:** sign in with Google and provision the user's own Drive storage on
  first login.
- **User story:** as a user, I log in with Google and the app silently creates (or
  reuses) my `Moneta` folder with empty data files and a seed config, then lets me in.
- **UI:** login screen with a "Sign in with Google" button; a route guard sends
  unauthenticated users there and blocks `/` until ready.
- **Data touched:** creates `Moneta/movimientos.json`, `Moneta/activos.json` (`[]`),
  and `appDataFolder/config.json` (from `CONFIG_SEMILLA`). Reads `drive/v3/about`
  for identity.
- **Edge cases:** GIS load failure, consent denied/cancelled, token expiry (silent
  re-auth → else login), Drive `401`/`403`, offline on first launch, repeated
  bootstrap must not duplicate.
- **Done when:** a fresh account ends with the folder + 3 files; re-login reuses
  them (no dupes); access token never persisted unencrypted; guard blocks `/` until
  authenticated; `auth.ts`/`drive.ts`/`bootstrap.ts` tests + `typecheck` + `lint` green.
- **Out of scope (own specs):** `pinLock.ts`, `repo.ts` CRUD.

## 11. Decisions log

- 2026-06-25 — Package manager: **bun**. Node: **24 LTS** (`.nvmrc`).
- 2026-06-25 — Routing: **React Router** (over wouter).
- 2026-06-25 — Local storage: **dexie** (over raw `idb`).
- 2026-06-25 — Linter: **oxlint + Prettier** (scaffold ships oxlint; kept it as
  the current standard, added Prettier for formatting).
- 2026-06-25 — IDs via native `crypto.randomUUID()` instead of the `uuid` package.
- 2026-06-25 — App name: **Moneta**.
- 2026-06-25 — Styling: **Tailwind CSS v4** (Vite plugin, no PostCSS) + **shadcn/ui**
  (Radix, Nova preset).
- 2026-06-25 — State: adopt **zustand** from the start (not "only if it grows").
- 2026-06-25 — Tests: **Vitest + Testing Library + user-event**. `fireEvent` is
  banned — always use `user-event` for interactions.
- 2026-06-25 — Drive storage format: **JSON files** (`movimientos.json`,
  `activos.json`, `config.json`), not a Google Sheets spreadsheet. 1:1 with
  `schema.ts`, only the Drive Files API under `drive.file`. Sheets export is a
  possible future, not v1.
- 2026-06-25 — Identity via `GET drive/v3/about?fields=user` with the access token,
  instead of a separate Google ID-token flow — avoids a second consent. Deviates
  from the literal "ID-token `sub`"; acceptable for v1.
- 2026-06-25 — Access token kept **in memory only** until `pinLock.ts` lands;
  no `localStorage`/unencrypted IndexedDB.
- 2026-06-25 — `config.json` lives in `appDataFolder`, but its location is
  abstracted behind one repo function so it could move to the visible folder later.
  No toggle UI in v1 (YAGNI).
- 2026-06-25 — First feature spec scoped to **login + Drive bootstrap only**; PIN
  lock and CRUD (`repo.ts`) are separate specs.
