# KuroBello — Specs (source of truth)

> **This file is the source of truth.** We work spec-driven: nothing gets built
> that isn't described here first. Before implementing a feature, write its spec
> in §10. After a decision is made, record it in §11. If reality and this file
> disagree, this file is wrong — fix it, don't silently diverge.

Schema version: **1** · Last updated: 2026-08-18

Display brand: **`APP_NAME`** in `src/lib/branding.ts` (currently "KuroBello",
provisional and expected to change freely). Storage identifiers are frozen at
the 2026-08-18 baseline (`KuroBello` / `kurobello` / `kurobello-lock-dek`) and
do NOT follow later display renames — see §11 2026-08-18.

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
  (Radix primitives, Manrope font + Lucide icons — see §11, 2026-08-18, which
  supersedes the original Nova-preset Geist choice). Components live in
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

- `Movimiento[]` — **flow** (in/out) → `movimientos.json` in the `KuroBello` folder.
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
- **Scopes (incremental authorization):** login requests **identity only**
  (`openid email profile`); the Drive scopes `drive.file` (per-file, non-sensitive) +
  `drive.appdata` are requested **later**, when the user opts into Drive sync
  (`connectDrive`). So logging in shows no Drive consent — the app is local-first.
  If an existing file must be opened, use the Google Picker together with `drive.file`.
- Identity = the user's Google account, read from the **`userinfo` endpoint**
  (`https://www.googleapis.com/oauth2/v3/userinfo` → email + name) with the identity
  token. No users table.
- **Bootstrap (deferred, via `connectDrive`):** when Drive sync is enabled, request the
  Drive scopes, then find the `KuroBello` folder (via `drive.file`); if absent, create it.
  Ensure `movimientos.json` + `activos.json` exist in it (`[]`), and `config.json`
  (seeded from `CONFIG_SEMILLA`) in `appDataFolder`. Idempotent (find-before-create).
  Access token kept in memory only until `pinLock.ts` adds encrypted caching.
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

- **Goal:** sign in with Google (identity only); Drive provisioning is a separate,
  opt-in step so the app is usable local-first without forcing Drive on first login.
- **User story:** as a user, I log in with Google and get in immediately; my `KuroBello`
  folder + data files are created only when I turn on Drive sync (`connectDrive`).
- **UI:** login screen with a "Sign in with Google" button; a route guard sends
  unauthenticated users there and blocks `/` until authenticated.
- **Data touched (login):** requests identity scopes only (`openid email profile`) and
  reads the `userinfo` endpoint. **No Drive access, no writes.**
- **Data touched (connectDrive, deferred):** creates `KuroBello/movimientos.json`,
  `KuroBello/activos.json` (`[]`), and `appDataFolder/config.json` (from `CONFIG_SEMILLA`).
- **Edge cases:** GIS load failure, consent denied/cancelled, token expiry (silent
  re-auth → else login), offline on first launch; for `connectDrive`: Drive `401`/`403`,
  repeated bootstrap must not duplicate (find-before-create).
- **Done when (login):** a fresh account reaches `authenticated` with identity, no
  Drive writes; access token never persisted unencrypted; guard blocks `/` until
  authenticated; `auth.ts` + `authStore` tests + `typecheck` + `lint` green.
- **Done when (connectDrive):** calling it ends with the folder + 3 files; calling it
  again reuses them (no dupes); `drive.ts`/`bootstrap.ts` tests green. UI entry point
  ships with the Drive-sync opt-in (deferred, see §12).
- **Out of scope (own specs):** `pinLock.ts`, `repo.ts` CRUD, the Drive-sync opt-in UI.

### 10.2 PIN lock + biometric unlock

Full design: `docs/superpowers/specs/2026-06-26-pin-lock-design.md`.

- **Goal:** optional per-device lock. Unlock prioritises biometrics (FaceID /
  TouchID / fingerprint via WebAuthn) with a mandatory 4-digit PIN fallback. The
  cached OAuth token is encrypted at rest; either method decrypts it.
- **User story:** I enable the lock, set a 4-digit PIN, optionally turn on
  biometrics; on cold start or after 7 min in background the app asks for
  biometrics, falling back to the PIN.
- **UI:** minimal here (PIN keypad + biometric button + enable toggle); the
  polished lock-screen design is a separate spec the user will propose.
- **Data touched:** a single encrypted `LockVault` record in IndexedDB (token
  cipher, PIN/biometric DEK envelopes, salts, throttle counters, `lastActiveAt`).
  No `schema.ts` change.
- **Crypto:** envelope encryption — one random DEK encrypts the token; the DEK is
  wrapped separately by `PBKDF2(PIN)` and by the WebAuthn `PRF` secret (HKDF).
- **Edge cases:** no WebAuthn/PRF → PIN-only; biometric cancel → PIN; wrong PIN →
  throttle (5 → forced re-login); corrupt vault → re-login; logout keeps the
  vault; offline unlock defers silent re-auth.
- **Done when:** (crypto/store core — DONE) `pinLock.ts` + `lockStore.ts` provide
  envelope encryption, biometric/PIN unlock, throttle, token rotation, and the
  re-lock triggers; biometric offered only where PRF exists; token never stored
  unencrypted; tests + `typecheck` + `lint` green. (Activation — DEFERRED, see §12)
  the user-facing "enable lock" flow and the `updateSession` token-refresh wiring
  land with the polished UI spec.
- **Out of scope (own specs / deferred — see §12):** the **enable-lock UI** (entry
  point that calls `lockStore.enable`) and wiring `updateSession` into the token
  refresh path — both ride with the polished UI; the polished lock-screen visual
  design; `repo.ts` CRUD; encrypting the local financial-data cache.

### 10.3 Data port (`Repo`)

- **Goal:** a single storage-agnostic contract the rest of the app depends on
  for reading/writing `Movimiento`, `Activo`, and `Config`, so every feature
  (movimientos UI, dashboard, Drive sync) is built against one interface
  instead of a concrete storage engine. Local IndexedDB (dexie) is the first
  implementation; Drive-backed sync is a second implementation behind the
  same port (§11, 2026-07-02).
- **User story:** as a developer, I write features against `Repo` without
  knowing or caring whether data currently lives in IndexedDB or Drive;
  swapping/adding an implementation never touches a consumer.
- **UI:** none — pure data-access contract, no component.
- **Data touched:** `Movimiento[]`, `Activo[]`, `Config` (per `schema.ts`).
  No new fields; the port changes how data is accessed, not the model.
- **Design, deliberately generous for scale (see §11 decision):**
  - `movimientos` and `activos` share one generic `CrudRepo<T>` shape
    (`list`/`get`/`add`/`addMany`/`update`/`remove`/`removeMany`) instead of
    one-off methods per entity — less duplication as entity types are added.
  - `list()` takes an optional query (date range, section, sort,
    `limit`/`cursor`) from day one. A personal-finance app accumulates years
    of `Movimiento` rows; baking in filtering/pagination now avoids a
    breaking change to every call site once "load everything into memory"
    stops being viable.
  - `addMany`/`removeMany` for bulk paths (CSV import, migrations) that are
    inevitable once real usage starts.
  - `Config` stays atomic (`getConfig`/`updateConfig`) — it's small (tens of
    rows, not years of transactions) and is one JSON file in
    `appDataFolder`; fine-grained CRUD on `secciones`/`categorias` would be
    over-engineering the one part that doesn't grow like `Movimiento` does.
  - Errors are a typed `RepoError` (`code: 'not_found' | 'schema_mismatch' |
'network' | 'unknown'`) instead of raw throws, since a Drive-backed
    implementation fails in more ways (network, auth) than IndexedDB does,
    and callers need to branch on failure kind uniformly across
    implementations.
  - `ready()` runs the `schemaVersion` check/migration before first use —
    every implementation must expose it, not just the local one.
- **Edge cases:** empty store (fresh account) → `list()` returns
  `{ items: [] }`, not an error; `get()` on a missing id → `undefined`, not
  a throw; `update`/`remove` on a missing id → `RepoError('not_found')`;
  `ready()` detects a stale `schemaVersion` and runs the pending migration
  before any other call proceeds.
- **Done when:** `src/lib/repo.ts` exports the `Repo`/`CrudRepo`/`RepoError`
  contract (interface only, no implementation) and `typecheck` is green.
  Implementing it (dexie-backed) and its tests are Track A's job (§12).
- **Out of scope (own spec/track):** the local (dexie) implementation, the
  Drive-backed implementation, the movimientos UI.

### 10.4 Drive-sync opt-in + Welcome screen

Full design: Claude Design canvas `Moneta.dc.html` ("AUTH: WELCOME" and
"AUTH: DRIVE PERMISSION" blocks) — see `docs/ui/implementation-plan.md`,
"Auth: Welcome + Drive permission".

- **Goal:** replace the bare dev-harness `LoginScreen` with the real,
  designed onboarding flow, and give `authStore.connectDrive` (provisions
  the `KuroBello` folder + files, §10.1) its missing UI caller — closing the
  §12 "Drive-sync opt-in UI" backlog item.
- **User story:** as a user, I open the app, sign in with Google
  (`WelcomeScreen`), and am then asked once whether to turn on Drive sync
  (`DrivePermissionScreen`). Choosing "Permitir y continuar" upgrades my
  session to the Drive scopes and provisions my Drive folder; choosing
  "Ahora no" drops me straight into the app, local-first, and I'm not asked
  again until my next fresh sign-in.
- **UI:**
  - `WelcomeScreen` (`src/features/auth/WelcomeScreen.tsx`): full-bleed dark
    screen, `APP_NAME` wordmark, "Continuar con Google" triggers the real
    `authStore.login()` (identity scopes only — no Drive consent here, §5).
    Busy state while `status === 'authenticating'`; inline error on
    `status === 'error'`.
  - `DrivePermissionScreen` (`src/features/auth/DrivePermissionScreen.tsx`):
    shown once per authenticated session, right after login, before the
    rest of the app. Explains the two Drive permissions in plain language
    (create-own-files, no-access-to-other-files) per the design copy.
    "Permitir y continuar" calls `authStore.connectDrive()` with a busy
    overlay ("Conectando con tu Drive…") while it runs; on failure shows a
    real inline error and stays on the screen (retry or "Ahora no" both
    stay reachable). "Ahora no" dismisses the screen without calling
    `connectDrive`.
  - `RequireAuth` (extended, not rewritten): unauthenticated → `WelcomeScreen`;
    authenticated with `driveOptIn === 'pending'` → `DrivePermissionScreen`;
    authenticated with `driveOptIn` `'connected'` or `'dismissed'` → the
    app. Account-chooser screen in the design is **not built** — GIS's
    `initTokenClient` shows Google's real chooser in its own popup; a
    hand-rolled copy of Google's own UI would be redundant and would drift
    from what Google actually renders.
- **Data touched:** no `schema.ts` change. `authStore` gains an in-memory
  `driveOptIn: 'pending' | 'connected' | 'dismissed'` field (default
  `'pending'`, reset to `'pending'` on every fresh `login()`, never
  persisted — see §11 decision below) plus `driveConnecting`/`driveError`
  for the busy/error UI. `connectDrive` itself already touches Drive per
  §10.1 (`KuroBello` folder + 3 files) — unchanged here, only wired to a
  real caller.
- **Edge cases:** GIS load failure / consent denied on `WelcomeScreen` →
  existing `auth.ts`/`authStore` error surface, screen stays usable, retry
  reachable. `connectDrive` failure (network, `401`/`403`, popup closed) →
  `driveError` set, `driveOptIn` stays `'pending'` so the user can retry or
  fall back to "Ahora no"; the already-authenticated identity session is
  **not** torn down by a Drive failure (`status`/`error` are for identity
  auth only, `driveError` is separate). Re-running `connectDrive` after an
  earlier successful run must stay idempotent (already guaranteed by
  `bootstrap`'s find-before-create, §10.1). Cold start with the PIN lock
  enabled resumes via `hydrate` after unlock — `driveOptIn` is **not**
  reset there, so re-locking/unlocking mid-session never re-prompts Drive.
- **Done when:** `LoginScreen.tsx` is deleted; `RequireAuth.tsx` routes to
  `WelcomeScreen`/`DrivePermissionScreen`/`children` per `status`/`driveOptIn`;
  `authStore.connectDrive` has error handling and a real caller;
  `pinLock.updateSession` is wired into every `authStore` path that lands a
  fresh `AuthSession` (see the separate §11 decision below); `WelcomeScreen`,
  `DrivePermissionScreen`, extended `authStore`/`RequireAuth` tests, and
  `bun run check` are green.
- **Out of scope (deferred, see §12):** a persistent "don't ask again" for
  Drive sync and a way to re-enable it later — Profile sheet's Drive row,
  Wave 2.

### 10.5 Shared UI kit + fake repo

- **Goal:** the foundational, cross-feature component layer + a shared
  in-memory `Repo` implementation every Wave 2 screen builds on, so
  `BottomSheet`/`MovimientoRow`/etc. and their look-and-feel are defined
  once instead of per-screen, and every screen reads/writes the same
  fake data (a write from one screen must show up on another immediately).
- **User story:** as a developer building a screen (Home, Search, Movement
  sheet, Tags, Groups…), I compose it from `src/components/shared/**`
  and read/write through the shared `fakeRepo` instance instead of
  inventing my own mock data or re-deriving category → icon/color myself.
- **UI:** `src/components/shared/**` — `BottomSheet`, `CenterModal`,
  `IconAvatar`, `MovimientoRow` (+ `movimientoView.ts`, the one place
  category → icon/tint/color and signed-amount formatting live), `TagChip`,
  `DateChipPicker`, `SegmentedControl`, `Toggle`, `InfoButton`. Dev-only
  gallery at `src/routes/Kit.tsx` (`/kit`, gated on `import.meta.env.DEV`)
  renders every component/variant for visual verification.
- **Data touched:** `src/lib/repo.fake.ts` — `createFakeRepo(options?)`
  (fresh isolated instance, e.g. for tests) and a shared singleton
  `fakeRepo` export (the one every screen should import). Implements
  `Repo` from `src/lib/repo.ts` exactly as that interface exists today —
  no changes to the port's shape. Seeded with several months of `Movimiento`
  (extends `CONFIG_SEMILLA.categorias` with the design's demo categories —
  Comida, Transporte, Compras, Ocio, Salud, Hogar, Regalo, Freelance — so
  `movimientoView.ts` has real variety to map) and a handful of `Activo`.
- **Edge cases:** empty store → `list()` returns `{ items: [] }`; `get()` on
  a missing id → `undefined`; `update`/`remove` on a missing id →
  `RepoError('not_found')`; `list()` honors `dateFrom`/`dateTo`/`seccion`/
  `sortBy`/`sortDir`/`limit`/`cursor` together (index-encoded cursor,
  fine for an in-memory store); an unknown/custom category in
  `movimientoView.getMovimientoVisual` falls back to a `tipo`-based
  icon/tint instead of throwing.
- **Done when:** every component has a colocated `*.test.tsx`
  (`user-event`, not `fireEvent`), is keyboard-reachable with ≥44px touch
  targets and sensible `role`/`aria`; `repo.fake.ts` has `repo.fake.test.ts`
  covering the edge cases above; `bun run check` is green; `/kit` renders
  every component/variant, verified at a ~390×844 viewport.

**Decisions made while building this (see §11 for the dated entries):**
BottomSheet/CenterModal share one `useOverlay` hook (Escape, focus trap,
body-scroll lock, focus restore — not in the public barrel, internal to the
two shells); `IconAvatarTint` maps onto the existing `chart-1..5` +
`success`/`danger`/`info`/`neutral` tokens instead of new hex values;
`DateChipPicker` takes `firstDayOfWeek` as a prop rather than reading
`Config.preferencias.primerDiaSemana` itself, keeping it repo-agnostic —
the calling screen reads the preference and passes it down;
`RepoErrorCode` gained an `invalid_input` case (coordinated with the
operator, since `repo.ts` is Track A's file) so the fake repo can reject a
non-positive `monto` the same way a real implementation should, instead of
silently disagreeing with schema.ts's "monto always positive" invariant.

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
- 2026-06-26 — Integrated `feat/auth-drive-bootstrap` to `main` (trunk-based, no
  `develop`). Real end-to-end OAuth still unverified — see §12.
- 2026-06-26 — PIN lock unlock model: **biometrics prioritised, mandatory PIN
  fallback** (option C). Biometrics = WebAuthn platform authenticator (one
  mechanism; the device picks FaceID/TouchID/fingerprint), not three methods.
- 2026-06-26 — Lock crypto: **envelope encryption** (one DEK encrypts the token;
  DEK wrapped per method) over two separate ciphertexts — single token cipher
  survives rotation cleanly. Biometric key via **WebAuthn PRF extension**; no PRF
  → biometrics not offered (PIN-only), never a weak gate-only fallback.
- 2026-06-26 — Lock triggers: re-lock on **cold start** + after **7 min** in
  background, detected via the Page Visibility API (elapsed computed on return,
  no background timer).
- 2026-06-26 — **4-digit PIN**; brute-force resistance relies on the 5-attempt
  throttle + PBKDF2, not PIN entropy (casual-access threat model, §5).
- 2026-06-26 — PIN-lock UI kept minimal in this spec; polished lock-screen design
  deferred to its own spec (user to propose).
- 2026-06-26 — Lockout (5 wrong PINs) and "forgot PIN" wipe the vault and return
  the app to **`unlocked`** phase (not `locked`), so the guard falls through to
  `LoginScreen` for a fresh Google re-login. Setting `locked` after wiping the
  vault would strand the user on a lock screen that can never unlock.
- 2026-06-26 — PIN-lock shipped as **crypto/store core only**; the enable-lock UI
  entry point and `updateSession` token-refresh wiring are deferred to the polished
  UI work (§12). The feature is dormant until those land.
- 2026-07-02 — **Data layer goes local-first.** `repo.ts` is built as a storage
  **port** (interface) the rest of the app consumes; the first implementation is
  local (IndexedDB via dexie). Drive stays the v1 sync target but is a swappable
  implementation behind the same port, so features can be built without a working
  OAuth/Drive path. A hosted **DB backend is explicitly rejected for now** — it
  breaks §2 (developer would host users' financial data) and is only reconsidered
  if a §6 trigger appears; the port keeps that migration cheap.
- 2026-07-02 — **Bootstrap decoupled from login.** `login()`/`restore()` fetch
  identity only (no Drive writes); Drive provisioning moved to `authStore.connectDrive`
  (calls `bootstrap`), to be triggered by a Drive-sync opt-in. Lets login be verified
  end-to-end without exercising Drive, and keeps the app usable local-first. `hydrate`
  (post-unlock) likewise no longer bootstraps.
- 2026-07-02 — **Incremental authorization; identity via `userinfo`.** Login requests
  only `openid email profile`, so no Drive consent appears at sign-in; Drive scopes are
  requested on demand in `connectDrive`, which upgrades the in-memory session to the
  Drive-capable token. **Reverses the 2026-06-25 decision** to read identity from
  `drive/v3/about` (that required a Drive scope at login); identity now comes from the
  `userinfo` endpoint. The "second consent" the old decision avoided is now the desired
  behavior — the Drive prompt should appear only when sync is turned on.

- 2026-08-18 — **Display brand decoupled from storage identifiers.** The
  user-facing name is `APP_NAME` in `src/lib/branding.ts` (single source: UI,
  `index.html` title via a Vite `transformIndexHtml` hook, PWA manifest, WebAuthn
  `rp.name`). Currently "KuroBello"; it will change often, so a rebrand = edit
  one constant + the Google Cloud Console branding field. Since no user data
  exists yet, the storage identifiers were rebased once from the old "Moneta"
  codename and are **frozen from now on** at: Drive folder `KuroBello`, dexie DB
  `kurobello`, HKDF info `kurobello-lock-dek`, package name `kurobello`. They
  must NOT follow later display renames — once real data exists, changing any of
  them requires an explicit migration recorded here. (Supersedes the 2026-06-25
  "App name: Moneta" entry; "Moneta" survives only in git history and in the
  dated design docs under `docs/`.)
- 2026-08-18 — **Agent rules are model-agnostic.** Project rules moved from
  `CLAUDE.md` to **`AGENTS.md`** (the cross-tool standard read by Codex, Cursor,
  Gemini CLI, Zed…); `CLAUDE.md` is now a thin pointer that imports it. Any
  agent gets identical instructions.
- 2026-08-18 — **`bun run check`** (typecheck + lint + test) added as the single
  done-gate: no task is "done" and nothing merges without it passing.
- 2026-08-18 — **Parallel-agent workflow adopted.** One agent = one branch = one
  worktree, with per-track file ownership declared in §12; `specs.md` edits from
  parallel tracks are append-only. Trunk-based merges to `main` stay the rule.
- 2026-08-18 — **`Repo` port interface (§10.3) designed generously for scale,
  on purpose.** Deviates from the project's usual "no speculative
  abstraction" default: the user explicitly asked for this one contract to
  be over-built because the app is expected to grow a lot and the port is
  the seam every feature depends on — hard to widen later without touching
  every consumer. Concretely: generic `CrudRepo<T>` instead of per-entity
  methods, `list()` ships filter/sort/pagination from day one, bulk
  `addMany`/`removeMany`, a typed `RepoError`. `Config` was deliberately
  left atomic (not over-built) since it doesn't grow the way
  `Movimiento`/`Activo` do — the generosity is targeted, not blanket.
- 2026-08-18 — **UI design source connected: Claude Design project
  `18d93152-c2e6-4bde-8eff-f944b1537ad8` (`Moneta.dc.html`).** The user
  actively keeps adding screens to it — treat as a living source, not a
  snapshot; re-pull before implementing a screen. Read via `DesignSync`;
  full screen-by-screen breakdown and the design ↔ code sync workflow live
  in `docs/ui/implementation-plan.md`.
- 2026-08-18 — **Native-app, touch-first UI direction adopted.** Touch/swipe
  is the primary interaction model (Pointer Events, deliberate
  `touch-action`, no hover-only affordances); native-feeling screen
  transitions use the design's own easing (`cubic-bezier(.32,.72,0,1)`,
  tokenized as `--ease-ios`). Mobile-first only for now — no desktop design
  exists yet, but the interaction model must not assume click-only so
  tablet/desktop can be added later without rework. See `AGENTS.md` § UI.
- 2026-08-18 — **Design tokens centralized in `src/styles/index.css`**,
  extracted from the Claude Design canvas: colors mapped onto shadcn's
  existing semantic slots (so installed components adopt them for free) plus
  extra tokens for the design's finer text/status/surface tiers; an explicit
  (non-formulaic) radius scale; a dense-mobile-UI font-size scale overriding
  Tailwind's default; the design's real animation keyframes/easing. Rationale
  and what was deliberately left un-tokenized (one-off layout spacing) in
  `docs/ui/design-tokens.md`. Light theme (`Preferencias.tema: 'claro'`)
  stays an unspecified placeholder — no light design exists yet.
- 2026-08-18 — **Fonts: Manrope, not Geist; icons: Lucide, not Phosphor.**
  Manrope follows the design (self-hosted via
  `@fontsource-variable/manrope`, same cost as Geist was) — supersedes the
  2026-06-25 "Nova preset: Geist font" line. Icons stay Lucide/`lucide-react`
  despite the design canvas using Phosphor via a CDN: a runtime icon CDN
  breaks this PWA's offline-first requirement, and switching icon sets would
  mean a new dependency plus remapping ~150+ icon references for a purely
  cosmetic difference. Full reasoning in `docs/ui/design-tokens.md`.
- 2026-08-18 — **Formalized as hard rules, not just this-one-case choices:**
  (1) no CDN dependencies ever — every font/icon-set/library is installed
  and self-hosted, no exceptions litigated per-dependency, since a CDN call
  breaks §3's offline-first requirement outright; (2) UI sizing uses
  relative units (`rem`, `dvh`/`dvw`) against a fluid width range, never a
  mockup frame's fixed pixel size. See `AGENTS.md` § UI for the concrete
  rules; both generalize decisions already made for fonts/icons above.
- 2026-08-18 — **Voice input: on-device, no backend, cleared to build.**
  Web Speech API's network round-trip goes to the browser vendor's own
  servers (e.g. Google, for Chrome) — we manage no key and host nothing, so
  this stays inside §2/§6 cleanly. It just means the mic is unavailable
  offline (disable it then) — a UX limitation, not an architecture
  exception. Transcript → fields via a client-side regex/keyword parser
  (amount reliably; date/category as a pre-filled suggestion the user
  confirms, not auto-committed).
- 2026-08-18 — **Receipt scan: deferred indefinitely, on-device quality not
  good enough yet.** Researched two on-device paths: Tesseract.js (OCR) is
  self-hostable but unreliable on real receipts (thermal-paper printouts —
  the common case — measured as low as ~60% character accuracy in one
  documented case); Chrome's on-device Prompt API (Gemini Nano) would give
  LLM-quality extraction with no backend, but is desktop-only in 2026 (no
  Android/iOS/ChromeOS) — doesn't cover this mobile-first app's primary
  platform at all. The alternative (a backend + cloud vision/LLM call, the
  §6 "hiding a third-party API key" trigger) was explicitly declined for
  now — user chose to defer the feature entirely rather than ship a weak
  OCR-assisted version or add a backend for it. Entry button stays
  disabled; revisit if mobile-grade on-device vision matures or the
  backend trade-off gets reconsidered.
- 2026-08-18 — **Voice category inference: regex/keyword parser confirmed
  as the real v1 answer, not a stopgap.** Checked whether on-device AI
  (text-only, unlike the receipt-scan image case) could improve category
  inference without a backend: Chrome's Prompt API (Gemini Nano) text mode
  has the _same_ desktop-only platform gate as its multimodal mode — being
  text vs. image doesn't change it — so it's unreachable on Android
  Chrome/iOS Safari, this app's actual mobile targets (~0% of real users
  could use it today). Android's/iOS's on-device AI (ML Kit Gemini Nano,
  Apple Foundation Models) are native-SDK-only, no web/PWA access. A cloud
  LLM call would need a backend (same §6 trigger as receipt scan) — not
  pursued, matching the scan decision above. Unlike scan, this one has a
  plausible future path (no heavy multimodal hardware requirement once a
  mobile-reachable on-device text API exists) — revisit only if that
  changes, don't re-research this without a real platform change.

- 2026-08-18 — **Dark theme actually applied.** `.dark` is the only designed
  palette but no element ever carried the class, so the app rendered with the
  light _placeholder_ scaffold. `<html class="dark">` is now hardcoded in
  `index.html`, and the PWA `theme_color`/`background_color` + the
  `theme-color` meta moved from the scaffold `#0f172a` to the real canvas
  `#0c0d10`. Reading `Config.preferencias.tema` to switch themes at runtime
  stays deferred until a light design exists (Track G, settings).
- 2026-08-18 — **Drive-sync "Ahora no" dismissal is in-memory, per-session,
  never persisted (Track B, §10.4).** `authStore.driveOptIn` lives only in
  the zustand store, reset to `'pending'` on every fresh `login()`. Rationale:
  the whole auth session is already access-token-only and rebuilt on every
  cold start by design (§5) — a per-session "ask again next time" matches
  that lifecycle exactly, no new persistence layer needed. A _persistent_
  "don't ask again" only makes sense paired with a way to turn Drive sync
  back on later, which doesn't exist yet — that pairing is Profile sheet's
  Drive row (Track G, Wave 2; see §12 follow-up below). Not written to
  `localStorage` (banned by §7) or to `db.ts` (Track A owns it this wave).
- 2026-08-18 — **`connectDrive` failure never tears down the identity
  session (Track B, §10.4).** `authStore` keeps `driveError`/`driveConnecting`
  separate from `status`/`error` (the identity-auth fields) precisely so a
  Drive provisioning failure (network, `401`/`403`, popup closed) leaves the
  user authenticated and able to retry or fall back to "Ahora no" — reusing
  the identity `status: 'error'` path would have wrongly booted an
  already-authenticated user back to the Welcome screen over an unrelated
  Drive failure.
- 2026-08-18 — **`pinLock.updateSession` wired into every `authStore` path
  that lands a fresh `AuthSession` (Track B, §12).** `login`/`restore`/
  `hydrate`/`connectDrive` all call it after a successful session update, so
  the vault's cached token stays fresh once the PIN lock is enabled — closing
  the other standing §12 gap (previously the cached token went stale after
  first expiry and every cold start forced a Google re-login, making the
  lock give zero convenience). Deliberately a silent no-op both when no
  vault exists (`pinLock.hasVault()` false — most users, lock never enabled)
  and, defensively, if the vault exists but isn't unlocked in this tab
  (`updateSession` throws `'lock: not unlocked'` in that race) — a
  session-caching side effect must never fail the primary auth flow it rides
  on. `hydrate` deliberately does **not** reset `driveOptIn` — it also fires
  on a mid-session re-lock/unlock (Page Visibility timeout, §10.2), where
  re-prompting Drive opt-in on every screen-unlock would be wrong; only an
  explicit `login()` resets it.

- 2026-08-18 — **Shared UI kit + fake repo (Track D, §10.5).** Built
  `src/components/shared/**` (`BottomSheet`, `CenterModal`, `IconAvatar`,
  `MovimientoRow`, `TagChip`, `DateChipPicker`, `SegmentedControl`,
  `Toggle`, `InfoButton`) and `src/lib/repo.fake.ts`. `RepoErrorCode`
  (`src/lib/repo.ts`) gained an `invalid_input` case — approved by the
  operator mid-track since `repo.ts` is Track A's owned file — so the fake
  repo can reject a non-positive `monto` (schema.ts's mandatory "monto
  always positive" convention) the same way any real implementation
  should, instead of a fake that silently disagrees with the real repo.
- 2026-08-18 — **`IconAvatarTint` reuses the existing chart/status tokens,
  no new hex.** Category color is presentation (`movimientoView.ts`), not a
  new brand color — `emerald/blue/purple/rose/amber` map onto
  `--color-chart-1..5`, plus `success/danger/info/neutral` for status-driven
  tints. Keeps every category color traceable to `src/styles/index.css`
  instead of a parallel palette.
- 2026-08-18 — **`DateChipPicker` takes `firstDayOfWeek` as a prop, not a
  `Config` read.** Foundational `src/components/shared/**` components stay
  pure/presentational with no repo/store dependency; the calling screen
  reads `Config.preferencias.primerDiaSemana` (via the repo) and passes it
  down. Keeps the component testable in isolation and reusable outside the
  app's own data layer.
- 2026-08-18 — **Fake-repo seed data uses deterministic string ids
  (`mov_seed_0`, …), not `crypto.randomUUID()`.** Deviates from schema.ts's
  "id = app-generated uuid" convention on purpose: the seed must be
  reproducible across runs/tests (no `Math.random()`, no bare `new Date()`
  — dates derive from an injectable `today`), and `randomUUID()` is
  incompatible with that by definition. Only applies to the fixed seed rows;
  anything added through the fake repo at runtime should still get a real
  uuid from the caller.

- 2026-08-18 — **`useOverlay` suppresses the panel's own focus ring
  (`outline-hidden`).** Visual-pass finding (Track D, §10.5): the panel
  container is `tabIndex={-1}` and only ever focused programmatically
  (initially, and as the fallback when an overlay has no focusable
  children at all) — never reached by keyboard Tab — but the global
  `outline-ring/50` base style (`src/styles/index.css`) still painted its
  `:focus-visible` ring on it once `.focus()` landed, drawing a ring
  around the whole sheet/modal. Reads as a web modal, not the native-feel
  transitions `AGENTS.md` § UI calls for. Fixed once at the shared
  `useOverlay` seam (`OVERLAY_PANEL_CLASS = 'outline-hidden'`, applied by
  both `BottomSheet` and `CenterModal`) rather than patching either
  component individually; focusable children keep their own ring
  untouched. Regression-tested with an overlay that has no focusable
  content (the case that actually triggers the panel-as-`activeElement`
  path).

## 12. Backlog (pending verification / deferred work)

- ✅ **Login verified end-to-end (§10.1)** — 2026-07-02. Real OAuth ran against Google
  with a Testing-mode client (`http://localhost:5173` origin, dev Gmail as test user):
  identity-only consent (name + email, **no Drive**), reached `authenticated`, no Drive
  writes. Production domain / app verification remains a later, production-only concern.
- **Drive-sync opt-in UI (§10.1).** `authStore.connectDrive` provisions the `KuroBello`
  folder + 3 files but has no caller yet (bootstrap decoupled from login, 2026-07-02).
  A user-facing "enable Drive sync" entry point must call it; until then the app runs
  local-first with no Drive writes. The Claude Design canvas's "Drive permission"
  screen is this entry point (see `docs/ui/implementation-plan.md`, "Auth" unit) —
  implement it from there rather than designing a new one. Verify then: first call → folder + 3 files; second
  call reuses them (no dupes).
- **Wire the PIN-lock activation (§10.2).** The lock's crypto/store core is merged
  and green; activation now has a minimal harness, one piece still pending:
  1. ✅ **Enable-lock UI (minimal)** — 2026-07-02. `LockSettings` on `Home` collects a
     4-digit PIN + optional biometric → `lockStore.enable`, plus "Lock now" (`lockStore.lock`,
     new manual re-lock action) and "Desactivar" (`reset`). `lockStore` gained an `enabled`
     flag so the UI knows the vault state. This is a **dev/test harness**, not the polished
     settings UI — that still rides with the polished-UI spec.
  2. **`updateSession` wiring** — `pinLock.updateSession` (re-encrypt a rotated
     token under the same DEK) exists and is tested but has no caller. Wire it into
     the token-refresh / `authStore` success path so the vault's token stays fresh;
     otherwise, once enabled, the cached token goes stale after first expiry and
     every cold start forces a Google re-login (lock gives no convenience).
     Both were flagged by the final whole-branch review (2026-06-26) as the gap
     between the §10.2 "Done when" and what shipped; tracked here so code and spec
     don't silently drift.
- **Rename the OAuth consent screen to the current brand** (user, in Google Cloud
  Console → Google Auth Platform → Branding → App name → "KuroBello"). Client ID
  and origins are untouched — no code change. In Testing mode the change is
  instant, no re-verification.
- **App icon for the brand.** The PWA still ships the scaffold `favicon.svg`;
  a KuroBello icon (maskable + favicon) is pending. Cosmetic, not blocking.
- ✅ **Drive-sync opt-in UI (§10.1/§10.4) closed** — 2026-08-18 (Track B).
  `DrivePermissionScreen` is the real caller for `authStore.connectDrive`,
  wired through `RequireAuth` right after login. `WelcomeScreen` replaces
  `LoginScreen`. See §10.4 and the §11 decisions above.
- ✅ **`updateSession` wiring (§10.2 item 2) closed** — 2026-08-18 (Track B).
  Wired into `login`/`restore`/`hydrate`/`connectDrive` in `authStore`; see
  the §11 decision above. §10.2's "Done when — Activation" is now fully met.
- **Persistent Drive-sync toggle (follow-up from §10.4/§11 2026-08-18,
  Track G, Wave 2).** The "Ahora no" dismissal deliberately doesn't persist
  (per-session only, see §11). Once the Profile sheet exists, add a Drive
  row there that reads `authStore.drive`/`driveOptIn` and can call
  `connectDrive()` on demand — the "turn it back on" counterpart that makes
  a persistent "don't ask again" viable later, if ever wanted.

### Parallel track plan (refreshed 2026-08-18, after UI analysis)

`src/components/shared/**` is a **new** location, distinct from
`src/components/ui` (shadcn primitives only, per `AGENTS.md`): it holds the
cross-feature composed components from `docs/ui/implementation-plan.md`
(`BottomSheet`, `MovimientoRow`, etc.) — reused across screens, so they
don't belong to any one feature folder. Same barrel/naming rule applies
(each component named after itself, never `index.tsx`).

**Wave 1 — 3 tracks, zero shared files, zero cross-dependency. Launchable now:**

| Track                                   | Scope                                                                                                                                                                                                                                                                                                                  | Owns                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **A — data port (real impl)**           | Real dexie-backed implementation of the `Repo` interface (interface already landed, §10.3). CRUD for `Movimiento`/`Activo`/`Config`, `schemaVersion` check. TDD.                                                                                                                                                       | `src/lib/repo.ts` (extend), `src/lib/repo.test.ts`, `src/lib/db.ts`  |
| **B — Drive opt-in + token refresh**    | Implements the real "Drive permission" screen (`docs/ui/implementation-plan.md`, Auth unit) — the entry point that finally calls `authStore.connectDrive`, closing the standing §12 backlog item. Also the Welcome screen (replaces `LoginScreen.tsx`), and wiring `pinLock.updateSession` into token refresh.         | `src/features/auth/**` (extend), `src/lib/authStore.ts`, specs §10.4 |
| **D — Foundational UI kit + fake repo** | Build, in this order: `BottomSheet`, `CenterModal`, `IconAvatar`, `MovimientoRow`, `TagChip`, `DateChipPicker`, `SegmentedControl`, `Toggle`, `InfoButton` (`docs/ui/implementation-plan.md`). Plus `repo.fake.ts` — one shared in-memory `Repo` impl, seeded Spanish sample data. **Blocker for every Wave 2 track.** | `src/components/shared/**` (new), `src/lib/repo.fake.ts`             |

**Wave 2 — unlocked once D merges (every screen needs the shared kit + fake
repo). Pick tracks per natural grouping, not necessarily all at once:**

| Track                              | Scope                                                                                                                                                                                                                         | Owns                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **E — Home + Search + History**    | Dashboard (extend `Home.tsx`) + the `movimientoStats` aggregation module (real, pure computation, not a stub) + Search/Filter sheet + History overlay. One track: all three share `MovimientoRow` and the aggregation module. | `src/routes/Home.tsx`, `src/lib/movimientoStats.ts`, `src/features/search/**`, `src/features/history/**` |
| **F — Movement/Add sheet + Voice** | View/edit sheet, create sheet, delete confirm, toast, the Voice unit (Web Speech API + regex parser, §11 2026-08-18).                                                                                                         | `src/features/movimientos/**`                                                                            |
| **G — Tags + Profile + Settings**  | Tag picker, custom tag modal, profile sheet, "Personalizar" settings screen.                                                                                                                                                  | `src/features/tags/**`, `src/features/profile/**`, `src/features/settings/**`                            |
| **H — Groups ("Áreas")**           | List + detail + editor. Needs a schema addition first (`Grupo` type or `extra` on `Categoria`, own §10 write-up) — don't invent the shape inline while implementing.                                                          | `src/features/groups/**`, `src/lib/schema.ts` (additive only)                                            |

Not scheduled: receipt scan (deferred indefinitely, §11 2026-08-18); the PWA
icon and polished lock-screen items already in the backlog above.

### Worktree log

Every agent that creates a `git worktree` logs a row here the moment it does,
and updates the **Status** the moment the track's work merges to `main`. This
is how we know which worktrees are safe to `git worktree remove` — check this
table against `git worktree list` at the start of any parallel session and
remove anything marked done (or orphaned: on disk but not in this table, or in
this table but the branch is already merged/gone).

| Created    | Track / task     | Path                         | Branch                | Status                  | Notes                                                                      |
| ---------- | ---------------- | ---------------------------- | --------------------- | ----------------------- | -------------------------------------------------------------------------- |
| 2026-08-18 | Wave 1 · Track A | `../moneta-wt/a-repo-dexie`  | `track/a-repo-dexie`  | active                  | Dexie-backed `Repo` implementation (§10.3). No dev server.                 |
| 2026-08-18 | Wave 1 · Track B | `../moneta-wt/b-drive-optin` | `track/b-drive-optin` | merged, pending cleanup | Welcome + Drive-permission screens, `updateSession` wiring. Dev port 5175. |
| 2026-08-18 | Wave 1 · Track D | `../moneta-wt/d-ui-kit`      | `track/d-ui-kit`      | merged, pending cleanup | Shared UI kit + `repo.fake.ts`. Dev port 5174.                             |

Status values: `active` (work in progress) → `merged, pending cleanup` (branch
merged to `main`, worktree not yet removed) → row deleted once
`git worktree remove <path>` runs.
