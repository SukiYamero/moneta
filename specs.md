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

Storage format is **JSON files** (only the Drive Files API under `drive.file`).
A Google Sheets export is a possible future, not v1.

> **The one-file-per-store layout above is superseded by §10.19** (decided
> 2026-08-19). Each store is now a set of **per-device, append-only operation
> logs**, movements sharded by month, because a single shared file per store
> cannot be written by two devices without losing an update and re-uploads the
> whole history to record one entry. The three logical stores and their types
> are unchanged — only how they are laid out in Drive. Read §10.19 before
> touching `bootstrap.ts` or anything that names a file.

Local cache of everything in IndexedDB (disposable; re-downloaded from Drive if
cleared). **The local database is always the merged truth**: the operation logs
are a storage and transport format, replayed once on download, and no screen
ever sees them.

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

### 10.3.1 Local (dexie) implementation — `repo.local.ts` (Track A, 2026-08-18)

Shipped `createLocalRepo(): Repo` in `src/lib/repo.local.ts`, backed by
`src/lib/db.ts` `v2` (additive: `vault` unchanged, `+movimientos +activos
+config`). TDD, 119 tests total (`repo.local.test.ts` + extended
`db.test.ts`), `bun run check` green. Implementation notes not obvious from
the port spec alone:

- **`ready()`** memoizes its in-flight/resolved promise in a module-level
  `WeakMap` keyed by the `db` connection (2026-08-18 revision — see §11; the
  first cut keyed it per repo instance, so two `createLocalRepo()` instances
  over the same `db` didn't dedupe a concurrent `ready()`), so `performReady()`
  runs **exactly once per database connection**, matching §10.3's "before
  first use" — not once per call, even though every `CrudRepo` method awaits
  `ensureReady()`. A resolved promise stays cached (a second, brief revision
  the same day briefly cleared on success too — see §11 — which reintroduced
  a schemaVersion round-trip on every single repo operation; reverted). Only
  a **rejected** attempt clears the entry, so a later call can retry instead
  of replaying the same failure forever. Tests reset this memo in `afterEach`
  via the test-only `__resetReadyMemoForTests()` export, since the test
  suite reuses one `db` singleton across files/tests while production
  expects it to live for the database connection's whole lifetime. Fresh
  install → seeds `CONFIG_SEMILLA`. `Config.schemaVersion` < `SCHEMA_VERSION`
  → dispatches through a `Record<number, Migration>` registry
  (`migrateSchema(from, to, registry)`, exported for unit testing
  independently of the real registry, which is empty at v1). `>
SCHEMA_VERSION` → `RepoError('schema_mismatch')`, no downgrade.
- **`CrudRepo<T>` is one generic factory** parameterized per entity by
  `{ table, dateField, seccionField, tiebreakField, compoundIndex, validate,
entityLabel }` — `movimientos` uses `fecha`/`seccion`/`createdAt`/
  `"movimiento"`, `activos` uses `fechaActualizacion`/`seccion`/no tiebreak
  field/`"activo"`. This is how `dateFrom`/`dateTo`/`seccion` in the generic
  `ListQuery<T>` resolve to a concrete field per entity without one-off
  methods; `entityLabel` names the entity in `update()`/`remove()`'s
  not-found error message instead of leaking the internal `dateField` name.
- **`update()`/`remove()` run their read-check-write as one atomic
  `db.transaction('rw', table, …)`** (2026-08-18 revision — see §11; the
  first cut did an unsynchronized `table.get` then a separate `table.put`/
  `table.delete`, which let two concurrent `update()` calls on the same id
  silently lose one's write). Validation still runs against the merged
  result inside the transaction.
- **Keyset pagination, with a real fast path — not just a safe API shape.**
  The opaque `cursor` is a base64 JSON envelope of `{ sortBy, sortDir,
sortValue, tiebreakValue, id }` — `sortBy`/`sortDir` record which query
  minted the cursor (2026-08-18 addition — see §11; the first cut omitted
  them, so replaying a cursor under a different `sortBy`/`sortDir` silently
  misinterpreted `sortValue` against the wrong field/order instead of
  erroring). `decodeCursor` takes the current call's `sortBy`/`sortDir` and
  throws `RepoError('invalid_input')` on any mismatch. `list()` has two
  implementations behind it now (2026-08-18 revision, see §11 — the first
  cut only had the slow one):
  - **Fast path** (`tryFastPath`), used whenever `sortBy` is the entity's
    own indexed date field (the default) and a `limit` is given — the
    common case, and the one §10.3's "years of `Movimiento` rows" rationale
    is actually about. It reads a _bounded_ window directly off a compound
    dexie index via `.where(index).between(lower, upper, true,
true).reverse()?.limit(limit + 1 + TIE_SAFETY_MARGIN).toArray()` — the
    query itself returns only that window, not the table. Bounding the
    upper (desc) or lower (asc) edge of the range at the cursor's own
    `{ sortValue, tiebreakValue }` tuple, inclusive, means each subsequent
    page's read starts exactly where the last one stopped instead of
    re-walking from the original `dateFrom`/`dateTo` edge every time.
  - **Slow path** (`listSlow`), the original in-memory implementation
    (index-narrows-then-materializes-then-sorts), used for the documented
    exception: an arbitrary non-indexed `sortBy`, `limit` omitted (the
    caller explicitly wants everything), or the fast path's own bail-out
    below.
  - **Why the fast path needs the date field compounded with the tiebreak
    field in the index** (`[fecha+createdAt]` / `[fechaActualizacion+id]`,
    plus `seccion`-prefixed variants — see the `db.ts` v2 entry below): a
    single dexie/IndexedDB range query only has one contiguous
    lexicographic order to walk. If the index were just the date field,
    same-day rows would come back in whatever order IndexedDB happens to
    tie-break the raw index by, which has no reason to agree with the
    cursor's `{ tiebreakValue, id }`-based "already returned" cut — a real
    bug that surfaced during a review pass (see §11): an inserted row tied
    on `fecha` with an already-returned row was silently dropped because
    the index's native tie order didn't match the comparator's. Compounding
    the tiebreak field into the index makes the index's own order **be**
    the full deterministic sort order, so there's nothing left to
    reconcile — the same fix that made this provably correct is also what
    makes it fast.
  - **`TIE_SAFETY_MARGIN` (32) and the bail-out**: the fast path fetches
    `limit + 1 + 32` rows and discards any that are `<=` the cursor. If
    that discard still leaves fewer than `limit + 1` usable rows _and_ the
    fetch hit its cap, it can't prove whether more data exists (an
    adversarial cluster of rows sharing the exact same `{ sortValue,
tiebreakValue }` bigger than the margin — e.g. a bulk import that
    stamped many rows with one identical `createdAt`) — it returns `null`
    and `list()` falls back to `listSlow`, which is always correct
    regardless of cluster size. Tested at both sides of that boundary: a
    10-row exact tie (within the margin, fast path only) and a 50-row exact
    tie (forces the bail, fallback exercised) both walk to completion with
    no skips or duplicates.
  - Because the comparison is against a value tuple, not an array offset,
    a row inserted between two page fetches never causes a skip or a
    duplicate in either path — verified with dedicated tests that insert a
    row between `list()` calls on both sides of the cursor.
- **Dexie query narrowing (slow path only).** `seccion`+date-range together
  use the `[seccion+fecha]` (or `[seccion+fechaActualizacion]`) compound
  index as a `.between()` range scan; `seccion` alone uses its single-field
  index; date-range alone uses the date field's index; no filter falls back
  to `.toArray()`. The in-memory filter pass still re-checks every
  condition afterward as a correctness safety net — the index narrowing is
  purely an optimization, never the source of truth. (The fast path has its
  own, separate narrowing — see above.)
- **Performance is asserted, not just implied.** A dedicated test seeds
  3,000 `Movimiento` rows across 200 distinct dates, spies on
  `db.movimientos.toArray` (must never be called — that's the literal bug
  being fixed) and on the shared `db.Collection.prototype.toArray` (every
  dexie read ultimately funnels through it, `Table.toArray` included, so
  spying there measures the true materialized-row count regardless of call
  path), and asserts a `list({ limit: 20 })` call materializes well under
  100 rows — nowhere near the 3,000-row table. A second test walks a
  2,000-row table page by page (25 rows/page) asserting every page stays
  bounded and every row is visited exactly once. Both were verified to
  actually fail against the old always-in-memory implementation (max
  materialized = the full table size) before being accepted, per the
  "prove it, don't just check output" bar.
- **Bulk ops are all-or-nothing.** `addMany`/`removeMany` run inside a
  single `db.transaction('rw', table, …)`; a bad row (failed validation,
  duplicate id) or a missing id in `removeMany` throws inside the
  transaction, which aborts the whole batch — verified empirically (a
  duplicate-id item in a 3-item `addMany` batch leaves zero of the 3
  committed, not 2-of-3). Rationale: a partially-committed financial import
  is worse than a fully-rejected one — the caller can't tell which half
  landed.
- **Error-code mapping for a duplicate `id` on write** (2026-08-18 addition
  — see §11): `add()`/`addMany()` catch Dexie's `ConstraintError` (single) /
  `BulkError` with a `ConstraintError` among its `failures` (batch) and
  surface `RepoError('invalid_input', …)` naming the offending id, instead
  of falling through to `wrapUnknown`'s generic `'unknown'` — a duplicate id
  is bad caller input (`id` must be unique), not a storage-layer failure.
  Matched purely by `.name === 'ConstraintError'` / `'BulkError'`, never
  `instanceof Error`/`instanceof Dexie.ConstraintError` or the message text:
  the individual entries in `BulkError.failures` are raw `DOMException`s
  that are NOT `instanceof Error` in this project's test environment (jsdom
  - fake-indexeddb) — an `instanceof Error` guard silently excluded exactly
    the batch case, caught by watching the discriminating test fail first.
    `BulkError.failures` is keyed by an internal operation index that does
    **not** reliably map back to the input array's position (verified
    empirically: a duplicate at input index 2 surfaced under failures key
    `"0"`), so the offending id for the error message is determined
    independently — a duplicate within the batch itself first, else one of
    the batch's ids already present in the table via `table.bulkGet` — rather
    than trusted from that index. Everything else still falls through to
    `'unknown'` unchanged; this is a narrow, name-matched carve-out, not a
    broadened catch-all.
- **Write validation** (`validateMovimiento`/`validateActivo`): `monto`
  finite and `> 0`; `fecha`/`fechaActualizacion` a real ISO `yyyy-mm-dd`
  (regex + round-trip through `Date`, rejects e.g. `2026-13-40`); `moneda`
  required. `Activo.valorActual` is additionally required to be finite and
  non-negative (not explicitly named in §10.3's bullet, which only calls
  out `monto`, but left silently unvalidated it's the one other place a
  malformed number could reach storage). All failures are
  `RepoError('invalid_input', …)` — see the new `RepoErrorCode` member
  below — and the row is never written.
- **`limit` is validated** (2026-08-18 addition — see §11): `list()`
  rejects `0`, negatives, non-integers, `NaN`, and `Infinity` with
  `RepoError('invalid_input')` before either `list()` implementation runs.
  The first cut let `limit: 0` through, which always produced an empty
  `page`, making `lastItem` `undefined` and silently dropping `nextCursor`
  even when more rows existed — "give me zero rows" isn't a meaningful
  pagination request, so it errors instead of returning an ambiguous
  `{ items: [] }`.
- **`updateConfig`** rejects a patch that sets `schemaVersion` explicitly
  (`RepoError('invalid_input')`) rather than silently dropping it — the
  field is structurally reachable through `Partial<Config>`, so a silent
  drop would let a caller believe the write succeeded. Everything else
  shallow-merges onto the stored row.
- **Immutability**: `add`/`update`/`get`/`getConfig` never return the
  literal in-memory object handed to or read from Dexie without going
  through a fresh spread first, and reads never mutate caller input.
  IndexedDB's structured-clone semantics mean this is also true "for free"
  across separate reads, but the explicit spreads make the guarantee hold
  even within one synchronous call.

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
  icon/tint instead of throwing. **`repo.fake.ts` deliberately mirrors
  `repo.local.ts`'s (§10.3.1) `ListQuery` defaults (`sortBy` defaults to the
  entity's own date field, `sortDir` defaults to `'desc'`), validation rules
  (`monto`/`valorActual` finite, `fecha`/`fechaActualizacion` ISO, `moneda`
  required, `updateConfig` rejecting a `schemaVersion` patch), comparator
  (three-level: sort field → per-entity tiebreak field → `id`, `sortDir`
  multiplied uniformly across all three levels), and error codes
  (`invalid_input` on a malformed/negative pagination cursor, matching
  `RepoError('invalid_input')` rather than silently treating it as index 0)
  — every Wave 2 screen is built and tested against this fake, so a place
  where it silently disagrees with the real implementation is worse than no
  fake at all. The one intentional difference is the cursor's wire shape:
  the fake keeps a plain index-encoded cursor (fine for an in-memory store
  with no compound index to walk) instead of `repo.local.ts`'s opaque
  `{ sortValue, tiebreakValue, id }` envelope — the _behavior_ (default
  sort, tiebreaks, rejecting garbage) is what's mirrored, not the wire
  format. `add`/`addMany` reject a duplicate `id` with
  `RepoError('invalid_input')` (an `addMany` batch is all-or-nothing: a
  duplicate anywhere in it — against the store or within the batch itself —
  aborts the whole batch, no partial insert), and `removeMany` rejects any
  missing id with `RepoError('not_found')`, aborting the whole batch —
  symmetric with what single-id `remove`/`update` already guaranteed
  (§11, 2026-08-18 final-sweep entry).**
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

### 10.5.1 Overlay stack + touch-target/API fixes (code review follow-up, 2026-08-18)

A code review of §10.5's initial build found three reproduced `useOverlay`
bugs plus a hard 44px touch-target violation, fixed on `fix/d-ui`:

- **`useOverlay.ts` gained a module-level overlay stack.** Every open
  `BottomSheet`/`CenterModal` instance registers a handle ordered by a
  `seq` assigned once at first render (not by open/close timing) — React
  renders ancestors before descendants, so a nested overlay (the
  delete-confirm `CenterModal` opening from inside the Movement
  `BottomSheet` — a real, reachable flow, not a hypothetical) always gets a
  higher `seq` than the overlay it's nested inside, regardless of which
  one's `open` flips true first or whether both mount already open in the
  same commit. Only the topmost handle (highest `seq` among the
  currently-open ones) reacts to Escape, traps Tab, and claims initial
  focus; the body-scroll lock is refcounted against the stack instead of a
  single acquire/release pair. This fixes three bugs that shipped past a
  green suite because no test covered two overlays open at once (now
  covered — `useOverlay.test.tsx`, "nested overlays" describe block):
  1. The initial-focus effect re-running (and re-stealing focus) on every
     parent re-render, because the natural `onClose={() => setOpen(false)}`
     is a new function identity each render and the effect depended on
     `[open, onClose]`. Fixed by keeping `onClose` in a ref and depending
     only on `[open]`.
  2. `Escape` closing every open overlay at once (each had its own
     `document` keydown listener with no notion of "topmost").
  3. A same-frame initial-focus race between nested overlays — React runs
     child effects before parent effects, so both RAFs could fire in the
     same frame with the outer sheet's running last and winning; now only
     the stack's topmost claims focus, so the winner is deterministic
     regardless of effect/RAF firing order.
- **`useEscapeToClose` (new, exported)** — a lighter sibling of
  `useOverlay` for surfaces that aren't a full portal/scroll-lock/focus-trap
  shell. `DateChipPicker`'s inline month-grid popover now uses it, sharing
  the same stack so Escape closes the popover first when it's open inside a
  `BottomSheet`, not the sheet behind it — this "just works" from the stack
  rather than needing bespoke wiring.
- **`initialFocus?: RefObject<HTMLElement | null>`** added to
  `BottomSheetProps`/`CenterModalProps` (forwarded to `useOverlay`) — an
  escape hatch to focus a specific element on open instead of "the panel's
  first focusable descendant," which was wrong for e.g. the Add sheet's
  amount input.
- **`ref` accepted and forwarded** (React 19: an ordinary prop, no
  `forwardRef`) on `BottomSheet`, `CenterModal`, `TagChip`, `Toggle`,
  `InfoButton`, `SegmentedControl` (container), `DateChipPicker`
  (container), and `MovimientoRow` — the components a screen might
  plausibly need to measure or imperatively focus. `IconAvatar` was left
  out (purely decorative, `aria-hidden`, never a focus/measurement target).
- **44px touch-target floor fixed on `TagChip`, `SegmentedControl`, and
  `DateChipPicker`** (all three were below it — `min-h-9`/`h-[34px]`/
  `size-7`), by splitting each into an outer 44px-floor hit target (via
  `min-h-11`/`min-w-11`, invisible padding) wrapping an inner element that
  keeps the pill/icon at its originally-designed visible size — the same
  split `Toggle`/`InfoButton` already used, applied consistently instead of
  inflating the visible chip/icon to reach 44px. `DateChipPicker`'s
  `h-[34px]` was additionally a relative-units violation (AGENTS.md § UI);
  replaced with the `h-9` Tailwind step used elsewhere in the kit.
- **`disabled?: boolean` added to `TagChip` and per-option on
  `SegmentedControlOption`** (`Toggle` already had it). A disabled
  `SegmentedControl` option is skipped by arrow-key navigation (wraps past
  it, per the APG radiogroup pattern) rather than becoming reachable but
  inert.
- **`SegmentedControl`'s keyboard handler now targets siblings via
  per-button refs** (`buttonRefs.current[index]`), not
  `event.currentTarget.parentElement?.children[nextIndex]` — the old
  approach only worked because the render output happened to be a flat
  `<button>` list and would have broken silently under any wrapping
  variant.
- **`movimientoView.ts`'s `Intl.NumberFormat` instances are memoized** in a
  `Record<Moneda, Intl.NumberFormat>` at module scope instead of being
  constructed on every `formatMonto` call — `MovimientoRow` calls this per
  row per render in a list expected to grow to years of entries.
  `getMovimientoVisual`'s category fallback was reviewed and confirmed
  already total (an unmapped/custom category degrades to a `tipo`-based
  icon/tint via `??`, covered by the existing "unknown category" test) —
  no code change needed there.
- **`BottomSheet`'s drag-to-dismiss hardened**: `setPointerCapture`/
  `hasPointerCapture`/`releasePointerCapture` calls are now feature-detected
  (`?.()`) — jsdom (and some minimal WebViews) don't implement them at all,
  which would otherwise throw on the first pointerdown. `pointercancel` now
  resets drag state without checking the dismiss threshold (a cancelled
  gesture — system gesture, multi-touch conflict — is never user intent to
  dismiss). Added an `onLostPointerCapture` handler as the reliable
  catch-all for a drag that ends outside the browser window, where the OS
  never delivers a pointerup/pointercancel back to the page.
- **Done when (addendum):** `useOverlay.test.tsx` (new) covers two overlays
  open simultaneously — the scenario absent from the original suite that
  let all three bugs ship. `bun run check` green.

### 10.6 Toast — the global notification surface

- **Goal:** one app-wide surface any code can push a short message to, so an
  error or confirmation raised where no screen owns it still reaches the
  user. Designed in `docs/ui/implementation-plan.md` ("Toast (generic,
  global — build once, used after save/delete/add)"); the rule for when to
  use it instead of an inline message is `docs/error-handling.md` §7,
  "Where an error is allowed to land".
- **User story:** as a user, when I save a movement from a sheet that closes,
  or delete one by swiping, I see a short confirmation — and if it failed, I
  find out then, not when the number silently doesn't change.
- **UI:** a stack of short-lived cards. Callable from anywhere (a store, an
  event handler, a component) through a plain function — no provider prop
  drilling, no per-feature copy of the component.
  - **Stacking, in arrival order.** Concurrent toasts do not replace one
    another: the first raised is the first shown, newer ones join the stack.
  - **Each keeps its own timer.** A toast's dismissal countdown is its own —
    a later arrival never extends, resets, or shortens an earlier one.
  - Success and error read differently (`--color-success` / `--color-danger`
    tokens); animation uses the shared `animate-*` tokens and respects
    `prefers-reduced-motion`.
  - Sits above every overlay (a sheet or modal must never cover it) and
    clear of the safe-area insets and the bottom nav.
  - Touch-first: swipe to dismiss via Pointer Events, per `AGENTS.md` § UI.
    It is a **notification, not a dialog** — it never blocks, never traps
    focus, never asks a question. Anything needing a decision is a
    `CenterModal`.
- **Data touched:** none. Presentation only; it holds no domain state and
  reads no store.
- **Edge cases:**
  - **Two or more at once** → stack, oldest at the anchored edge, each
    expiring on its own schedule; the rest must not jump when one in the
    middle leaves.
  - **A cap on the stack** (a retry loop must not paper the screen). Decide
    the number when building; oldest beyond the cap is dropped, not queued
    indefinitely.
  - **The same message repeating** (a failing action retried) → collapse
    rather than stack N identical cards.
  - **Raised from a surface that then unmounts** — the whole reason this
    exists: it must live at app root, outside the router, so a closing sheet
    cannot take it down with it.
  - **Raised while the app is locked** → must not render over `LockScreen`;
    a notification about data is content, and the lock exists to hide
    content.
  - **Accessibility:** errors announce assertively (`role="alert"`), routine
    confirmations politely (`role="status"`). A timed message the user
    cannot pause or dismiss fails WCAG 2.2.1, so dismissal must always be
    reachable — and a screen reader user must not lose the message to a
    timer before it is read.
  - **Never render a raw `.message`** — Spanish copy only, per
    `docs/error-handling.md` §5/§7.
- **Done when:** any module can raise a toast without importing a feature;
  concurrent toasts stack in arrival order with independent timers (tested);
  it survives the unmounting of whatever raised it (tested); it is not
  visible over `LockScreen`; swipe- and keyboard-dismissible; `bun run
check` green.
- **Out of scope:** undo affordances inside a toast, persistence across
  reloads, and any queue that outlives the session — none are needed by the
  screens that consume it.

### 10.7 Region-aware formatting + the initial currency (user request, 2026-08-19)

- **Goal:** money and dates are formatted for the **region of the device**,
  not for the region that happens to match the copy language, and a first-run
  user is not silently assigned Colombian pesos because that is what the seed
  file says.
- **User story:** as a user in Mexico, I open the app for the first time and
  see Mexican pesos grouped the Mexican way — not `COP 12,000.00`. As a user
  anywhere, an expense reads `$ -12.000,00`: the minus belongs to the number,
  not to the currency.
- **Why this is a real gap, not a preference:** the copy locale and the
  formatting region are two different things and Wave 2 conflated them.
  `SupportedLocale` is a _copy_ locale — `es` is neutral Spanish for five
  countries whose number formats disagree with each other (`es-CO` groups
  `1.234,56`, `es-MX` groups `1,234.56`). §11's 2026-08-19 entry recorded the
  `es → es-CO` mapping as a deliberate trade-off with this exact revisit
  condition. This is that revisit.
- **UI / behavior:**
  - **Region comes from the device**, read from the region subtag of
    `navigator.language`/`navigator.languages` (`es-MX` → `MX`), falling back
    to the copy locale's canonical region when the browser gives no subtag.
    The **copy** locale keeps resolving exactly as it does today
    (`detectLocale`) — this adds a second, independent axis; it does not
    change which language the UI speaks.
  - **The initial `monedaPrincipal` derives from that region** (`MX` → `MXN`,
    `AR` → `ARS`, `BR` → `BRL`, `PE` → `PEN`, `CO` → `COP`, `EC`/`US` → `USD`,
    …), applied **only when seeding a config that does not exist yet**. A
    stored `Config` always wins: this is a first-run default, never a
    reassignment of a currency the user already has.
  - **The currency always renders as a symbol** (`Intl`'s
    `currencyDisplay: 'narrowSymbol'`), never the ISO code. Standard `Intl`
    shows `COP` rather than `$` when the currency is foreign to the
    formatting region; that disambiguation is deliberately traded away for a
    consistent look (see Edge cases).
  - **The sign attaches to the number, not to the currency:** `$ -12.000,00`,
    not `-$ 12.000,00`; likewise `$ +3.200,00` for the signed income variant
    `getMovimientoAmountView` renders. Build this from `formatToParts`, not by
    string-prepending a character — the symbol's position is locale data
    (`R$ ` leads in pt-BR; other locales trail it), so a hand-built string is
    wrong the moment the locale changes.
- **Data touched:** `Config.preferencias.monedaPrincipal` at seed time only.
  `Moneda` widens from `'COP' | 'USD'` to include the currencies of the
  regions the locale list already targets. **This is additive** — every
  existing value stays valid, no stored data changes meaning — so it needs no
  `SCHEMA_VERSION` bump and no migration, per `AGENTS.md`'s structural-change
  rule (which covers rename/split/delete, not widening).
- **Edge cases:**
  - **`CONFIG_SEMILLA` must stay a static constant.** Deriving its currency
    at module-import time would reproduce, exactly, the defect shape §11
    (2026-08-19) records twice: _a value evaluated at import time from an
    environment the test suite happens to make favourable_. The region-derived
    currency is applied by the **seeding path**, as a function, not by the
    constant.
  - **There are two seeding paths and both must be fixed** — `repo.local.ts`
    (dexie) and `bootstrap.ts` (the Drive files). Fixing one and leaving its
    twin is the single most expensive mistake this project has recorded
    (`AGENTS.md` § How every agent works).
  - **An unknown or missing region** falls back to today's behavior (`COP`,
    `es-CO` grouping) rather than guessing.
  - **`narrowSymbol` collides across currencies**: `$` means COP, MXN, ARS
    and USD alike. Accepted deliberately (user decision, 2026-08-19) — the app
    shows one currency at a time and a multi-currency view does not exist yet.
    When one does, it needs a way to disambiguate that is not the ISO code
    bolted back on globally.
  - **A negative balance** (`totals.balance`) already flows through the same
    formatter, so the sign rule must be a property of the formatter, not of
    the movement-row call site.
- **Done when:** a device in `es-MX` seeds `MXN` and groups `1,234.56`; a
  device in `es-CO` is unchanged from today; the stored config always beats
  the detected region; expenses render `$ -12.000,00` in all four locales
  (tested via `formatToParts`, not string equality against one locale);
  `bun run check` green.
- **Out of scope:** a currency/region picker in Settings (Track G, Wave 3),
  FX conversion, and per-movement currency in the UI. The field has always
  supported multi-currency; nothing here starts using it.

### 10.8 Category color in `TagChip` (user request, 2026-08-19)

- **Goal:** a category's color is one fact, shown consistently. Today the
  movement rows tint each category via `getMovimientoVisual`'s
  `CATEGORY_TINT`, while the selector chips ignore that tint and paint every
  selected chip the same primary green.
- **User story:** as a user, when I pick "Comida" in the filter sheet, it
  reads amber — the same amber the Comida rows use — so I can scan by color
  instead of by reading every label.
- **UI:**
  - The chip's **icon always carries its category tint**, selected or not, so
    the palette is legible before anything is chosen.
  - **Selecting tints the whole pill** in that same family (border,
    background, text), replacing the single `primary` treatment.
  - Unselected chips keep their neutral surface — only the icon is colored.
  - The 44px touch-target split (`specs.md` §10.5.1, §11 2026-08-19) is
    unchanged: the hit area grows, the pill does not.
- **Data touched:** none. `CATEGORY_TINT` in
  `src/components/shared/movimientoView.ts` stays the single source of truth
  for which color a category is — `TagChip` receives a tint, it does not map
  one.
- **Edge cases:**
  - **A custom category with no entry in `CATEGORY_TINT`** falls back to the
    type-based tint that `getMovimientoVisual` already returns — the same
    fallback the rows use, not a second rule.
  - **`neutral` as a tint** must still read as selected when chosen;
    a selected neutral chip cannot be indistinguishable from an unselected one.
  - **Contrast** in both themes: the tints are the existing `chart-*`/status
    tokens, so no new color values enter the system
    (`docs/ui/design-tokens.md`).
- **Done when:** every category chip shows its own color in the filter sheet,
  selected chips are tinted per category rather than uniformly green, an
  unknown category falls back to its type tint, and `bun run check` is green.

### 10.9 Loading states — the three tiers (user request, 2026-08-19)

- **Goal:** the app never looks frozen, and it never flashes a loader for
  work that finished in 80ms. A no-backend, local-first app has little to
  wait for; the loading system's job is mostly to **stay out of the way**.
- **User story:** as a user, the app opens straight into content. When
  something genuinely takes a moment, the screen keeps its shape and fills
  in — it does not blank, jump, or spin at me.
- **The constraint that shapes this:** `dataStore.load()` is
  **once per session and shared by all three screens** (`src/lib/dataStore.ts`
  short-circuits on `ready`). Home, Search and History read the same store,
  so **switching tabs has no data wait at all**. A per-navigation loader
  would therefore be a lie — it would only ever flash. The real waits are
  (1) app boot and (2) a lazily-loaded route.

**Tier 1 — screen (boot and lazy routes).** One `ScreenLoading` component:
full-screen, brand-consistent, used while the app resolves auth on a cold
start and as the `Suspense` fallback for any lazily-loaded route (`/kit`
today, more in Wave 3). **Not** used on tab changes — there is nothing to
wait for.

- **Fixes a real bug:** `RequireAuth` renders `WelcomeScreen` whenever
  `status !== 'authenticated'`, which includes the `authenticating` state
  during `restore()`. A cold boot with a stored session therefore **flashes
  the login screen before entering**. Boot must render `ScreenLoading`, not
  the login screen, until `restore()` settles.

**Tier 2 — section (in-screen).** Skeletons that match the loaded layout, so
the screen fills in rather than reflowing. The chrome around them — header,
tabs, bottom nav — **never** disappears. `HomeLoadingState` already does
this correctly and is the model. Search renders a text label and History a
bare `<p>`: three screens, three treatments. Unify them on one `Skeleton`
primitive.

**Tier 3 — action (a write in flight).** The busy state lives **on the
control that was pressed** — never a full-screen overlay, never a blocking
modal. The control stays in place, disabled, with its label swapped or a
small inline spinner. `WelcomeScreen`'s Google button already does the label
swap; that is the pattern. Wave 3's sheets are the main consumers; today's
are the auth buttons.

- **Exception — the auth gate screens (`WelcomeScreen`,
  `DrivePermissionScreen`) may block the whole screen** while their one
  action runs, and `DrivePermissionScreen`'s existing overlay is
  **deliberate, not a violation** (user, 2026-08-19). The Tier 3 rule exists
  to stop a loader covering content the user was reading; on these two
  screens there is no such content — the screen _is_ the single decision,
  and the OAuth flow it waits on is genuinely modal and external to the app.
  Blocking there communicates the truth. This exception is scoped to those
  two screens by design intent, and does not extend to any screen that
  renders data. An earlier draft of this section generalised the rule from
  the data screens and wrongly flagged the overlay as a defect.

- **The anti-flash rule, which is the whole point.** A shared hook gates
  every tier: **do not show a loader until the work has been pending for
  ~150ms, and once shown keep it for ~350ms** so it cannot blink in and out.
  Work that finishes fast shows nothing at all. Tune the exact numbers when
  building; the two-sided rule (delay before showing, minimum once shown) is
  what is binding.
- **Never replace content that is already on screen.** A _refresh_ of data
  already displayed shows the stale content, not a skeleton — only a first
  load has nothing to show.
- **Data touched:** none. Presentation only.
- **Edge cases:**
  - **Accessibility:** a skeleton is `aria-hidden` decoration plus one
    `sr-only` `role="status"` announcement — not fifty announced boxes.
    `HomeLoadingState` already has this shape. Loading is `role="status"`
    (polite); errors stay `role="alert"` (`docs/error-handling.md` §7).
  - **`prefers-reduced-motion`** is handled globally in
    `src/styles/index.css`; the pulse must not bypass it.
  - **A loader that outlives its cause** — if a load errors, the skeleton is
    replaced by the error state, never left spinning forever.
- **Done when:** boot no longer flashes the login screen; the three screens
  share one skeleton primitive and one loading treatment; a fast load shows
  no loader at all (tested with fake timers against the delay rule); `bun run
check` green.
- **Out of scope:** pull-to-refresh, optimistic write UI (no writes exist
  yet), progress bars for determinate work (nothing is determinate here),
  and any per-tab-navigation loader — see the constraint above.

### 10.10 Guest entry (user request, 2026-08-19)

- **Goal:** a person can use the app without handing over a Google account
  first. Identity is a _sync_ feature here, not a gate — the app's data layer
  is local anyway (`specs.md` §3).
- **User story:** as someone trying the app, I tap "Continue as guest" on the
  first screen and I am in — no account, no Drive dialog.
- **UI:** on `WelcomeScreen`, below the Google button: an `or` divider, then
  the guest button, with **generous separation** between the two zones so
  they read as two distinct choices rather than one stack of buttons. The
  Google button stays the primary, visually dominant action; guest is
  secondary. Copy goes through the `auth` namespace like everything else.
- **Behavior:** guest **skips both** the login and the Drive-permission
  screen and enters the app. A guest has no Google session, so nothing is
  cached to encrypt and no Drive folder is provisioned.
- **The UI must say the data is local to this device** — a guest who assumes
  they are synced and then loses the device is the failure mode worth
  spending a line of copy on.
- **Data touched:** none directly. Guest reads through the same
  `repoProvider` stub every screen uses today, so it is not a second data
  path — when the Drive-backed `Repo` lands, guest simply keeps using the
  local one (§12).
- **Edge cases:**
  - **Guest is a distinct state, not a fake authenticated user.** Do not
    synthesize a `user`/`session` to slip past the guard — anything reading
    `user` must be able to tell there isn't one.
  - **The PIN lock** exists to protect a cached Google token
    (`specs.md` §10.2). A guest has no token; whatever the lock does for a
    guest must be a decided answer, not an accident.
  - **`driveOptIn`** must not sit `pending` for a guest, or the Drive screen
    reappears on every boot.
  - **Leaving guest** (signing in with Google afterwards) — what happens to
    anything recorded as guest is **explicitly deferred to Wave 3**
    (operator + user decision, 2026-08-19), when a Drive-backed `Repo` makes
    the question real. Until then the UI's "local to this device" line is the
    honest contract.
- **Done when:** the first screen offers both paths with the divider and
  spacing above; guest enters the app without seeing the Drive screen; a
  guest is distinguishable from an authenticated user in the store; boot does
  not flash the login screen for either path; `bun run check` green.
- **Out of scope:** guest→Google migration, a "you are in guest mode" banner
  inside the app, and any account-creation flow.

## Wave 3 — foundations. Specs §10.11–§10.17

Written 2026-08-19, **not implemented**. Wave 3 is plumbing: what every later
feature assumes already exists. Evidence: `docs/wave-3-audit-runtime.md` and
`docs/wave-3-audit-surface.md`. Each spec below carries a **Blast radius**
line — how much of the codebase it should touch — because the answer for most
of these is "less than it sounds", and a track that touches more than its
blast radius says has misunderstood the job.

### 10.11 Offline entry, network state, and the offline session window

- **Goal:** the app opens and works without a network, and says so honestly
  when it can't do something. `specs.md` §3 has claimed "offline-first" since
  the beginning; today both entry paths call Google, so the claim is false.
- **User story:** I'm on the subway. I open the app, unlock with my
  fingerprint, look at this month's spending, and add the coffee I just
  bought. Nothing asks me to sign in.
- **The two defects to fix** (both CONFIRMED, traced):
  - `authStore.restore()` calls `authenticate('')` on cold boot; offline it
    throws, falls to `idle`, and strands the user on `WelcomeScreen`.
  - `authStore.hydrate()` calls `fetchGoogleUser()` **after** a fully local
    vault decrypt, so PIN/biometric unlock fails offline. The blocker is a
    profile fetch — name and avatar. That is decoration, not authorization:
    the vault already proved identity locally. Cache the profile alongside
    the session and treat `fetchGoogleUser()` as a refresh, never a gate.
- **Network state gets an owner.** `navigator.onLine` appears nowhere in
  `src` today. One small store owns online/offline (plus the `online`/
  `offline` events); everything else reads it. `navigator.onLine` lies in one
  direction — it reports `true` for a connected-but-dead network — so treat
  it as a hint, and let a failed request downgrade it.
- **The offline session window — decided (user, 2026-08-19): 7 hours, and
  reduced permissions while offline.**
  - Offline you may **read everything and create movements**. You may not
    edit, delete, or change settings.
  - The reason this split is right, and worth keeping when someone
    re-litigates it: **appends commute, mutations don't.** Two devices
    creating movements offline merge cleanly because every `id` is a
    `crypto.randomUUID()`. Two devices editing or deleting the same movement
    produce a genuine conflict with no correct automatic answer.
  - The window starts at the **last successful online validation**, not at
    app launch. After 7 hours the app blocks new writes and asks the user to
    reconnect — reads stay available, because refusing to show a user their
    own local data protects nobody.
  - Copy must never imply data loss. Shape: _"Reconéctate para seguir
    agregando — Llevás más de 7 horas sin conexión. Lo que registraste está
    guardado en este dispositivo; conectate a internet para sincronizarlo con
    tu cuenta."_ (Final wording lives in the `i18n` table, all four locales.)
- **The unified error copy** (user request): the three screens share one
  message for a failed load, **derived from the `RepoErrorCode`** rather than
  a generic per-screen string. Today only Home tells the user _why_ it failed
  — Search and History discard the code and say something generic, so a user
  with no connection is told "couldn't load" on two screens out of three. The
  mapping in `src/features/home/errorCopy.ts` is not Home-specific; it maps a
  global `RepoErrorCode` and should move to a shared home.
- **Edge cases:** an expired token with valid local data (read-only, don't
  bounce to login); coming back online mid-session (revalidate quietly, don't
  interrupt); a guest, who has no token and should never see a reconnect
  prompt; the lock's own error path (`SESSION_RESTORE_ERROR`) must
  distinguish "wrong PIN" from "no network".
- **Done when:** airplane mode + biometric unlock reaches the dashboard with
  real data; a create works offline and a delete is refused with an honest
  message; past 7 hours writes are blocked and reads are not; all three
  screens name the actual failure.
- **Blast radius:** `src/lib/authStore.ts`, `src/lib/lockStore.ts` (small),
  `src/lib/pinLock.ts` (cache the profile in the vault), a new network store,
  a shared `errorCopy`, and the three screens' error rendering. **No screen
  layout changes, no schema change.**

### 10.12 CSV export — "download your movements"

- **Goal:** the user can pull their movements into a spreadsheet. That is the
  whole feature. It is **not** a backup, **not** a restore path, and there is
  **no import** — see the rejections below, which are decisions, not gaps.
- **User story:** I want to cross my expenses with something else, or hand
  them to my accountant, so I download a file and open it in Excel.
- **Explicitly rejected (user decision, 2026-08-19) — do not "complete" this
  later:**
  - **No JSON backup file.** Manual backup-and-restore has poor real-world
    use, and it is the expensive half.
  - **No import.** Validating a file, handling schema versions, deciding what
    happens when data already exists, and handling a tampered file is a large
    surface for a flow almost nobody walks.
  - **The data-safety answer is Google, not a file.** Data lives locally on
    the device; a user who wants it kept links their Google account. That is
    simpler for both sides than a file the user has to remember to make.
- **The consequence, stated plainly rather than left implicit:** until Drive
  sync exists, **local data can be lost with no recovery path** — a browser
  evicting IndexedDB, private mode, or a lost device. We are accepting that
  window knowingly. A guest is permanently in it by design, which is exactly
  what `auth.welcome.guestReassurance` already tells them ("si lo perdés, se
  pierde con él"). CSV export happens to give both a manual out, but that is
  a side effect, not its purpose. See §12.
- **UI:** one action in the profile sheet (§10.18) that produces a CSV of the
  user's movements.
- **CSV correctness — the hazards to build against.** Every one of these
  produces a corrupt or dangerous file in Excel and all are cheap to handle
  **if known before writing the code**, which is why they are recorded here:
  1. **UTF-8 BOM is required.** Without it Excel renders `Café` as `CafÃ©`.
     Every Spanish category and free-text note is affected.
  2. **Separator: `;`, with a leading `sep=;` line.** Excel under a Spanish
     regional configuration expects `;`, not `,`. Excel honours the `sep=`
     hint; most other tools ignore the line harmlessly.
  3. **Decimal comma, paired with the `;` separator.** These two go together:
     writing `12000,50` with a comma separator breaks every row. Use the
     active locale's formatting (§10.7) rather than a hand-rolled number
     string.
  4. **CSV injection — a security issue, not a formatting one.** A field
     whose value starts with `=`, `+`, `-` or `@` is executed as a **formula**
     by Excel and Sheets. `Movimiento.nota` and category names are free text
     written by the user, so this is reachable. Escape by prefixing such
     values (e.g. with `'`) or quoting them; do not skip this because "our
     own users write the notes" — a shared or imported file makes it
     someone else's problem.
     Dates go out as ISO `yyyy-mm-dd`.
- **Mobile matters here.** This is a mobile-first app: on iOS a plain
  `<a download>` typically opens a tab instead of saving. Use
  `navigator.share({ files })` where available — it is also the native-feeling
  path — and fall back to a download link elsewhere.
- **Edge cases:** an empty dataset (a header-only file, not an error); a very
  large dataset (build the file in chunks rather than one giant string); the
  file must never contain the OAuth token, vault material, or anything from
  the lock; the filename should carry a date.
- **Done when:** the file opens in Excel under a Spanish locale with correct
  accents, columns and decimals; a note beginning with `=` is inert when
  opened; sharing works on iOS; it works offline.
- **Blast radius:** one new module + its tests, plus the button in §10.18.
  Reads through the existing `Repo` port, so it is unaffected by which
  implementation is active.

### 10.13 The write path

- **Goal:** one way to write, shared by every future feature. `dataStore`
  exposes only `load()`; `repo.updateConfig` is called by **zero production
  files**. Wave 4's three tracks all need writes on day one and would
  otherwise invent three conventions.
- **What it is:** mutation actions on `dataStore` (create/update/delete a
  `Movimiento`, update `Config`) with a single agreed convention for optimistic
  update, rollback on failure, and error surfacing. The Toast (§10.6) already
  exists for exactly this and has had no consumer since it was built.
- **The convention must decide, once:** optimistic or pessimistic; where the
  error lands (inline vs toast — `docs/error-handling.md` §7 already rules);
  whether a failed write rolls back the store or leaves it dirty; and how a
  write interacts with §10.11's offline permission window.
- **Edge cases:** two writes racing; a write while offline past the 7-hour
  window; a write that fails after the sheet that issued it has closed (the
  Toast's original justification).
- **Done when:** a movement can be created, edited and deleted through the
  store with tests covering success, failure and rollback; `Config` writes go
  through the same path; the offline window is enforced in one place, not per
  call site.
- **Blast radius:** `src/lib/dataStore.ts` and its tests. No screens — Wave 4
  consumes it. This is deliberately built with no UI on top of it.

### 10.14 Form primitives + confirm dialog

- **Goal:** Wave 4 has forms and nothing to build them with. Only
  `button.tsx` is installed from shadcn; the one text input in the codebase
  is a raw `<input>` in the dev-only `/kit` route.
- **What it is:** the shadcn `input`/`label` primitives added properly (and
  normalised per `AGENTS.md`'s namespace-import and `func-style` rules), plus
  the composed pieces Wave 4 needs: a labelled text field, a numeric/amount
  field that respects the active locale (`§10.7`'s formatter rules apply —
  never a hand-rolled parser), and a `ConfirmDialog` built on the existing
  `CenterModal` for delete confirmations.
- **Form accessibility comes with it:** label association and
  `aria-describedby` for errors. The overlay layer's a11y is already a real,
  tested system (`useOverlay`); the form layer has no equivalent only because
  no form field exists yet.
- **Edge cases:** an amount field under a locale that groups with `.` vs `,`
  — parse from the locale, don't assume; a confirm dialog must reuse
  `useOverlay`'s stack, never reimplement Escape/focus-trap/scroll-lock.
- **Done when:** the primitives exist, are in `/kit`, and a delete confirm
  can be assembled without touching overlay internals.
- **Blast radius:** `src/components/ui` (additive) + `src/components/shared`.
  Nothing else — no feature consumes it until Wave 4.

### 10.15 Local data scoping — profiles

- **Goal:** local data belongs to _someone_. Today `db.ts`'s tables are
  global to the browser, so the moment `repoProvider` stops returning the
  fake repo, a guest's data and every Google account's data land in the same
  tables. Deciding this **after** that swap is a user-data migration;
  deciding it before is a naming choice.
- **The model (confirmed direction, user + operator 2026-08-19):** one dexie
  **database per profile**, not a `profileId` column on every row. Isolation
  costs nothing at query time, deleting a profile is deleting a database, and
  cross-profile reads — which we never want — become impossible rather than
  merely discouraged.
  - **The existing `kurobello` database is adopted as the first profile**, not
    migrated. `AGENTS.md` freezes that identifier; additional profiles get a
    suffixed name.
  - A small **device-scoped registry** (the pattern `deviceStore` already uses
    for the Drive decision) lists profiles: id, label, kind (`local` |
    `google`), created/last-used timestamps, database name.
  - `repoProvider.getRepo()` binds to the active profile. **Because every
    screen already reads through `getRepo()`, switching profiles touches no
    screen, no `dataStore`, and no `schema.ts`.**
- **Nothing is ever replaced.** A user with local data who signs into an
  account that already has data ends up with **two profiles side by side** —
  no merge, no overwrite, no conflict resolution. Consolidation is an
  explicit, separate action the user asks for (below), never a side effect of
  signing in.
- **Consolidation, when the user asks for it:** "move these N local movements
  into this account" — implemented as a union by `id`. Safe by construction
  because every `id` is a `crypto.randomUUID()`; the early decision to use
  UUIDs is what makes merging a non-problem. What it cannot solve is
  **semantic duplicates** (the same real purchase entered on two devices):
  those are not id collisions, and heuristics over date+amount+category will
  be wrong sometimes — so consolidation must be reviewable, not silent.
- **The user-facing surface is Wave 5+, not this wave.** Wave 3 ships the
  scoping and the registry so the data is correctly separated from day one;
  the profile switcher in Settings comes with the account UI.
- **Edge cases:** the same Google account on two devices (different local
  databases, reconciled by Drive, not by this); a profile whose database
  fails to open; deleting a profile (irreversible — needs a confirm and,
  ideally, an export first, which §10.12 provides); guest data when the user
  later signs in (stays its own profile, untouched).
- **Done when:** a guest and a signed-in account read and write entirely
  separate stores on the same device; existing `kurobello` data is reachable
  as the first profile with no migration; `getRepo()` is still the only swap
  point.
- **Blast radius:** `src/lib/db.ts` (parameterise the name), a new profile
  registry + store, `src/lib/repoProvider.ts`. **Deliberately not** the
  screens, `dataStore`, or `schema.ts`.
- **Sequencing:** this **gates** the `repoProvider` swap to the real dexie
  repo. Do not flip the stub before this lands.

### 10.16 Service-worker update lifecycle

- **Goal:** a deploy doesn't break a user mid-session. `vite.config.ts` uses
  `registerType: 'autoUpdate'` and nothing imports `virtual:pwa-register`, so
  a new version takes over silently — the classic failure is a lazily-loaded
  chunk 404ing after the deploy because the open tab still holds the old
  manifest.
- **UI:** a non-intrusive "a new version is available — reload" affordance,
  following §10.9's Tier 3 rule (it is a notification, not a blocking modal —
  the Toast surface already fits).
- **Edge cases:** don't nag on every navigation; don't reload out from under
  a user mid-input; an update that arrives while offline.
- **Done when:** a simulated new SW produces the prompt, and taking it
  reloads to the new version cleanly.
- **Blast radius:** `vite.config.ts`, one small registration module, one
  Toast call. No feature code.

### 10.17 Local diagnostics log

- **Goal:** when a user hits a bug, somebody can see what happened. There is
  no backend by design (§6), so today every error dead-ends at `console.*` in
  a browser nobody is looking at — while `docs/error-handling.md` maintains a
  real error taxonomy whose information is then thrown away.
- **What it is:** a capped ring buffer in IndexedDB (bounded rows, oldest
  evicted) holding error code, a short context string, and a timestamp —
  **never** a token, a PIN, vault material, or raw user data — exportable
  through §10.12's download mechanism so a user can attach it to a bug report.
- **Edge cases:** the log must never itself throw into the path it is logging
  (a failure to log is swallowed, per `docs/error-handling.md`); it must be
  clearable; and it must not grow without bound.
- **Done when:** a forced repo failure appears in the log, the buffer evicts
  at its cap, and an export contains no secret.
- **Blast radius:** one module + the existing `console.*` sites. Lowest
  priority of the seven — do it last, or drop it if the wave is too big.

### 10.18 Profile / account screen — the access point

- **Goal:** one reachable place for account, profiles and settings. It is in
  Wave 3 **as the access point, not as its features** — the point is that the
  door exists and later work has an obvious home, instead of each feature
  inventing its own entry.
- **Why it earns a foundations slot:** it closes two backlog items that are
  stuck purely for lack of a screen to live on.
  1. **The PIN lock has no production entry point.** `LockSettings` — the
     only UI that enables, disables or manually re-locks the vault — lives on
     the dev-only `/kit` route. A shipped build today has a lock feature the
     user cannot reach.
  2. **Guest mode cannot persist because there is no way out of it**
     (§10.10). A "sign in with Google" row here is that exit, and unblocks
     persisting guest mode.
- **User story:** I tap my avatar, and I can see which profile I'm in, reach
  my settings, turn on the PIN lock, and export my data.
- **UI:** the design's profile slide-up, **enlarged** — it now carries
  profiles as well as settings, so the original height doesn't fit (user,
  2026-08-19). Follows the existing sheet conventions: `BottomSheet` +
  `useOverlay`, `animate-sheet-up`, Pointer Events, safe-area insets.
  Sections:
  - **Identity** — the Google account, or "Invitado" with the sign-in row.
  - **Profiles** — the list from §10.15's registry, with the active one
    marked. Read-only in this wave: switching, renaming and consolidating
    come later. If only one profile exists, the section still renders — it is
    how the user learns the concept exists.
  - **Security** — the real home for `LockSettings`, moved off `/kit`.
  - **Data** — export (§10.12's module gets its button here).
  - **Preferences** — theme, language, currency, week start.
- **Stubs must be honest.** Anything with no implementation renders as a
  visibly inert row carrying `// STUB(waveN): <what the real thing needs>`
  per `docs/ui/implementation-plan.md`. A row that looks tappable and does
  nothing is worse than one that reads as "not yet" — and this project has
  already ruled once (§11, on the notification dot) that a UI element making
  a claim the app cannot keep is a defect, not a placeholder.
- **Preferences are read-only until the write path exists.** Show current
  values; make the controls inert stubs unless §10.13 has landed. Do not
  invent a second write path here.
- **Data touched:** none directly. Reads `Config.preferencias`, the profile
  registry, and `authStore`.
- **Edge cases:** a guest (no Google identity, no Drive row promise to keep —
  but the sign-in row is the whole point); a device with one profile; the
  sheet's height on a small screen (it grew — it must still scroll inside
  `max-h` and clear the safe area, never push the nav off-screen).
- **Done when:** the sheet opens from the app shell, shows identity, profile
  list, lock settings and export; every unimplemented row is visibly inert
  and carries its `STUB` comment; the lock is configurable in a production
  build for the first time.
- **Blast radius:** `src/features/profile/**` (new), one entry point in the
  shell/Home header, and **moving** `LockSettings` out of `Kit.tsx`. It reads
  stores; it writes nothing.
- **Out of scope, deliberately:** switching profiles, renaming, deleting,
  consolidating local into an account, and any working preference control.
  Those arrive with the write path and the account work.

### 10.19 Drive sync — the file layout and the merge rule

Written 2026-08-19 after a full re-evaluation of the no-backend constraint
(§11, same date). **Not implemented.** This is the spec `specs.md` §12 has
called "the largest structural gap" since Wave 2: `bootstrap.ts` provisions
files in Drive and nothing ever reads or writes them again.

- **Goal:** the user's data reaches their Drive and comes back, on any number
  of devices, without a backend, without losing a record, and without
  re-uploading their whole history to record a coffee.
- **User story:** I record expenses on my phone all week with no signal. On
  Sunday it reconnects, everything lands in my Drive, and my tablet sees it
  next time I open it.

#### The core idea: files hold operations, not state

A data file is **an append-only list of operations**, not a list of
`Movimiento`s:

```json
{
  "v": 1,
  "device": "pj7k",
  "periodo": "2026-08",
  "ops": [
    { "op": "put", "hlc": "…", "basedOn": null, "mov": { "id": "3f9c…", "…": "…" } },
    { "op": "put", "hlc": "…", "basedOn": "…", "mov": { "id": "3f9c…", "…": "…" } },
    { "op": "del", "hlc": "…", "basedOn": "…", "id": "8b1e…" }
  ]
}
```

**Reading = replay every op from every file in logical order; per `id`, the
last one wins.** One rule covers create, edit, delete and cross-device merge.

Two consequences, both load-bearing:

- **`schema.ts` is untouched.** The sync metadata (`hlc`, `basedOn`, `op`)
  lives in the envelope, never on `Movimiento`. There is no `updatedAt` and
  no `deletedAt` on the domain type, and there must not be.
- **A `put` carries the whole record, never a diff.** An op that corrects a
  February movement is self-sufficient in an August file: a device that never
  downloaded February can still materialize the corrected record. A diff
  would be an orphan. This is why the format is snapshot-per-op.

#### The rule that makes conflicts impossible to construct

**Exactly one device ever writes any given file.** Not "we resolve the
race" — there is no race to resolve. No ETags, no retry-on-conflict, no
merge on the write path.

#### The files

| File                          | Where              | Written by       | Holds                                                          |
| ----------------------------- | ------------------ | ---------------- | -------------------------------------------------------------- |
| `mov-<device>-<YYYY-MM>.json` | `KuroBello` folder | that device only | movement ops for that month — the only file written day to day |
| `mov-<device>-<YYYY>.json`    | `KuroBello` folder | that device only | the year's months compacted into one, after the year closes    |
| `act-<device>.json`           | `KuroBello` folder | that device only | asset ops (few, no sharding needed)                            |
| `config-<device>.json`        | `appDataFolder`    | that device only | taxonomy + preferences; small, always fetched                  |

`<device>` is a short device-scoped id, minted once and kept with the other
device signals (`deviceStore.ts`).

- **Why monthly shards:** they bound the write size **forever**. Recording a
  coffee rewrites the current month (~60 KB under heavy use), never the 4 MB
  history. Without this, every entry re-uploads the whole past over mobile
  data by year three.
- **Why that grain specifically:** the app already thinks in periods —
  `movimientoStats.periodRange()` is día/semana/mes/año and Home renders a
  week. Home needs one shard, not the history.
- **A closed shard is frozen forever.** Editing an old movement does **not**
  reopen its file; the op lands in the current shard and wins on replay.
  Compaction folds only the closing year's own months, and **never rewrites
  an already-closed file**. That a corrected February record ends up living
  in an August file is cosmetically odd and functionally irrelevant, because
  the merge is global anyway — and it buys "closed means cacheable forever",
  which is what makes multi-year charts cheap.
- **Deliberately NOT built: a `manifest.json`.** It looks necessary and is
  strictly worse: it would be the one file with several writers, reintroducing
  the exact race this design removes — and it is redundant, because
  `files.list` already returns names and `modifiedTime` in one call. **The
  folder listing is the manifest.**

#### Ordering: a logical clock, not the device clock

Wall-clock ordering has a defect no amount of care fixes: **two devices can
compute different merge results.** UTC does not help — `Date.now()` is
already UTC; the problem is accuracy, not timezone. Asking a time server does
not help either, because the case that matters is offline, where there is
nobody to ask.

So ops are ordered by a **hybrid logical clock**: physical time combined with
a counter that advances past the highest value the device has seen, tie-broken
by device id. This yields a **total order identical on every device**, and it
degrades gracefully under a skewed clock instead of silently reordering.

Drive supplies the sanity bound: every API response carries a server `Date`
header, so a device whose clock claims 2099 can be clamped rather than
poisoning the maximum forever. That costs no extra request — we are already
talking to Drive.

**Two different timestamps, and only one of them is this problem:**
`Movimiento.fecha` / `createdAt` mean "when the coffee happened" and correctly
use the device clock — a few minutes of skew is irrelevant to a human record.
The op's ordering metadata is the one that must not be trusted to it.

#### Conflict detection, and what the user sees

A conflict is **not** about simultaneity. Two edits 19 days apart conflict if
neither device had seen the other's change; two edits 6 minutes apart do not
conflict if the second was made on top of the first. Wall-clock timestamps
cannot tell those apart. `basedOn` — the version an op was edited on top of —
can: two ops sharing a `basedOn` are genuinely concurrent; a chain is not.

**Decided (user, 2026-08-19): on a concurrent delete-vs-edit, the movement
revives, and the app briefly says why.** Losing data silently is worse than a
row the user can delete again — and the log already holds both versions, so
reviving costs nothing. The explanation is what makes it honest rather than
mysterious.

**Nothing is ever discarded at merge time.** The merge is a projection over an
immutable log, so the losing version is still in the file. A future "these two
changed in two places — which one?" review screen therefore needs **no new
storage, no conflict table and no format change**: restoring the other version
is an ordinary `put`. That screen is deliberately **not** in scope now — with
one device it can never fire — but the two things that keep it possible
(immutable ops, `basedOn`) are in the format from day one, because the format
is the expensive thing to change later.

#### How we know a profile is synced — a watermark, not a flag

Signing in with Google does **not** mean being synced: §5 is incremental
authorization, so the login asks for identity and the Drive scopes are a
separate, later consent. A user who dismissed the Drive prompt is signed in
with nothing to sync to.

Today the app can answer "what did the user reply to the prompt"
(`driveOptIn`, persisted per **device**) and "did the bootstrap succeed this
session" (`authStore.drive`, in-memory, never persisted — §11). It cannot
answer **"has this profile's data ever reached Drive"**, which is the question
every sync surface actually needs.

**Do not add an `isSynced` boolean.** It goes stale the moment it is written —
synced _when_, still true _now_, what about a push that failed halfway — and
`AGENTS.md`'s single-source-of-truth rule says derive rather than cache a copy
that can drift. Store a **watermark** instead: the last successful push and
the last successful pull. Every question is then derived, and none of them can
disagree with reality:

| Question                         | Derived from                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Is this profile linked to Drive? | whether it has a Drive binding at all                                                 |
| Has it **ever** synced?          | whether a last-success watermark exists — this is what gates the first-run view below |
| Is it up to date?                | outbox empty **and** a recent successful push                                         |
| Is anything pending?             | the outbox's `dirty` flag                                                             |

The three-state indicator (syncing · up to date · pending) is a projection of
those, never a fourth stored value.

**The watermark belongs to the profile, not the device.** "My data lives in
Drive" is a property of a profile — one device can hold a guest profile that
never synced beside a Google profile that did. It therefore lives on
`ProfileRecord` (§10.15), next to the account key, and is written only by the
sync engine. **A consequence worth naming: `driveOptIn` being device-scoped is
correct only while one profile exists.** Revisit it with the profile switcher;
do not quietly reinterpret a device signal as a profile one.

#### The first run of a profile — a dedicated download view

Signing in on a new device means the pull is not an optimization, it is the
**only** source of data. Rendering the dashboard while it runs shows `$0` and
"no movements" — a statement about someone's money that is false, and one they
will read as "the app lost my data." Same failure shape as the empty-account
cliff in §12.

So: when a profile has **no successful-pull watermark**, the app shows a
dedicated full-screen download view instead of the dashboard, and only then.
It is not a modal and not a per-launch gate — it is the first run of a
profile, once.

- Shows real progress (files reconciled of total), not an indefinite spinner:
  a multi-year history is a long wait, and an unmeasured wait reads as a hang.
- **A failure state with retry, never a dashboard of zeros.** If the pull
  fails, say so. Offer retry, and offer to continue with what is local —
  which, on a genuinely new device, is honestly nothing.
- **Never blocks a user out of local data they already have** (§10.11): a
  profile with a watermark reconciles in the background and the app opens
  normally, online or off.
- Follows §10.9's loading rules; this is the rare legitimate full-screen gate,
  because there is genuinely nothing truthful to render behind it.

#### When it syncs

- **Push** on: reconnect, return to foreground, a debounce after a burst of
  writes, and `pagehide`. Only when something is pending — the dirty flag is
  what keeps a reconnect free when there is nothing to send.
- **Pull** on app open and on reconnect, as a `files.list` revision check
  first; download only the files whose `modifiedTime` moved.
- **Never write through on the user's action.** A delete writes locally and
  disappears from the screen instantly; the same flush pushes it. Making the
  UI wait on the network _adds_ friction rather than removing it, and one
  write path beats two.
- **"Sync after the app closes" is not possible, and this is a platform
  limit, not a design choice.** When the page closes, JS stops. Background
  Sync exists on Chromium but not WebKit, so it can be a bonus on Android and
  never the plan; `fetch(keepalive)` caps the body at 64 KB, which a shard can
  exceed. **The moment is backgrounding, not closing.** This is precisely why
  §10.11's 7-hour window and its "saved on this device" copy exist.

#### UI

A non-blocking sync indicator (§10.9 Tier 3 — a notification, never a modal),
honest in all three states: syncing · up to date · **pending**. The third is
the one that earns trust, because it is the one that admits the data is not in
the cloud yet.

#### Getting your data out without the app — the plain-language file and the yearly CSV

The whole architecture exists so the data is the user's. That claim is only
true if a person can actually use it **the day the app stops existing**, so
this is not a nicety — it is the promise being kept or not kept.

**The honest starting point, stated rather than glossed over:** the data files
are an _operation log_, not a list of movements. The same `id` can appear
several times (a creation and its corrections) and there are `del` entries. So
naively converting one to a spreadsheet produces **duplicated rows and
resurrected deletions**. That is the price of choosing operations over state —
it buys one merge rule for conflicts, edits, deletes and multi-device, and this
is what it costs. Two cheap things pay it back.

**1. A plain-language file in the folder, written for someone who is not
technical.** `bootstrap` writes `LEEME.txt` into the `KuroBello` folder,
content localized to the user's locale (one fixed filename so the app can find
and rewrite it; the first line says what it is in their language). Rewritten
whenever the format version changes, never left describing an older shape.

It is written for a person, not a developer. It must say, in this order and in
ordinary words:

- what these files are, and that they are theirs;
- **that the `.csv` files are the easy path** — double-click, they open in
  Excel or Sheets, one per closed year;
- that the `.json` files are the complete record including corrections, and
  that the current year has no `.csv` yet;
- how to turn the JSON into a table if they need to, in one sentence a person
  can hand to an assistant or a friend: _keep the last entry for each `id`,
  and drop the ones marked `del`_;
- that nothing here is encrypted or locked — it is theirs to open, copy, or
  take somewhere else.

No jargon, no field-by-field schema dump. A person who has never opened a JSON
file should finish it knowing what to do.

**2. The yearly compaction also writes a flat CSV.** Compaction already
reduces a closed year to one surviving `put` per movement, so the flat table
already exists at that moment — writing it out is one extra file per year.
That turns "the app is gone" into **double-click and it opens**, for
everything except the months still open.

- It goes through **Track S's existing CSV module** (§10.12), so the four
  hazards it already solved — UTF-8 BOM, `sep=;`, the locale's decimal mark,
  and formula-injection escaping — come along for free. **Do not write a
  second CSV implementation.**
- It is **derived and disposable**: if it is missing, stale or hand-deleted,
  the JSON is authoritative and the app never reads the CSV back. Treating it
  as a source of truth would create exactly the second source of truth
  `AGENTS.md` forbids.

**The larger hole this does not close, and it is bigger than the format:** a
user who never connected Drive has **nothing there at all**. Portability is
not decided by the file format — it is decided by whether the file exists.
§12 already records that as an accepted risk and the guest copy says so out
loud; none of the above changes it.

#### Data touched

Reads and writes the Drive files above. **No `schema.ts` change.** Replaces
§4's fixed three-file layout — that section and `bootstrap.ts` must be updated
in the same change.

#### Edge cases

**Everything read from Drive is untrusted input, and this is a direct
consequence of the product's own promise.** The files live in the user's own
Drive, in a visible folder, as plain JSON — they can open `movimientos.json`
in an editor and mangle it, truncate it, or delete it. `drive.file` limits
what _we_ can see, never what _they_ can do. So the reader validates shape
rather than trusting it: `drive.ts`'s `readJsonFile<T>` **casts, it does not
check**, and that generic is a compile-time claim about runtime bytes. A
malformed file, a malformed entry inside a good file, and a file whose
`schemaVersion` is newer than this build must each degrade to "skip this and
keep going", never to a thrown boot or a silent zero. A truncated or failed
download must never be replayed as truth — half a file parsed as the whole
file is indistinguishable from data loss. An unknown `op` or a file written by
a newer version is **ignored and left untouched, never deleted**. A device that has not downloaded a shard yet shows
partial history, not wrong history. Compaction writes the new file and only
then deletes the months it replaced, and only its own. Two devices may hold
the same movement id only if a UUID collided, which is not a case to handle.

#### Done when

Two devices with the same account converge on the same data without either
losing a record; a movement created offline lands after reconnect; a delete
survives; an edit to a movement from eight months ago applies without
reopening its file; recording an entry uploads only the current shard.

#### Blast radius

A new `repo.drive.ts` behind the existing `Repo` port plus a sync engine and
its outbox, `bootstrap.ts`, and §4. **Not the screens** — they read through
`getRepo()` and must stay unaware that any of this exists. The op log is a
storage and transport format; the local database is always the merged truth,
and `movimientoStats` keeps receiving a plain `Movimiento[]`.

### 10.20 Signing out, and what a profile belongs to

Written 2026-08-19 after Track Y's review traced a confirmed defect and the
user worked through the cases. **Not implemented.**

- **Goal:** "Sign out" means what it says, and the data left behind belongs
  to someone identifiable rather than to whoever opens the app next.
- **The defect it fixes (CONFIRMED, traced):** `authStore.logout()` clears the
  in-memory session and re-locks the vault, but never invalidates the
  **encrypted session cached inside the vault**. With the PIN lock enabled,
  entering the correct PIN runs `unlockWithPin` → `resume()` → `hydrate()`
  with that same cached session and lands the user back in the account they
  just left. "Sign out" is behaviourally identical to the "Lock now" button
  one section below it. Unreachable until §10.18 shipped the control, so it
  is now user-visible, not latent.

#### Decided: signing out invalidates the vault

User decision. The vault exists to cache _that account's_ token; with no
account there is nothing left for it to protect, and §10.2 already sets the
precedent ("PIN reset = re-login with Google"). The visible consequence,
stated plainly rather than discovered: **the user also loses their PIN and
sets it again next time.** Rejected alternatives: keeping the PIN while
clearing only the session (you would enter a PIN to arrive at a login screen),
and hiding sign-out while the lock is on (honest, but leaves a user with a PIN
no way out of their own account).

#### A profile must know which account it belongs to

`ProfileRecord` is `{ id, label, kind, databaseName, createdAt, lastUsedAt }`.
`kind` says `'local' | 'google'` — _what_ a profile is, never _whose_. So
today two Google accounts on one device are indistinguishable in the registry,
and `getActiveProfile()` resolves by recency rather than identity: signing back
in does not return you to your own profile.

This is the hole that makes "just delete the data on sign out" feel
reasonable. **It is not the fix — deleting is the workaround for a missing
field.** The registry gains an account key; with it, two accounts are two
profiles and signing back in restores yours. Additive, no migration.

This is also what keeps §10.15's "nothing is ever replaced" true: destroying
local data as a side effect of signing out is exactly the side effect that
decision forbids, and §12 already carries an accepted "local data can be lost
with no recovery path" window that this wave is trying to **shrink**.

#### A guest's identity is the device, and we must not claim otherwise

A guest never signs out — the control only renders for
`status === 'authenticated'`. A guest closes the app, reopens it, and their
data is still there. **Not because we assume it is the same person: because
there was never a person, only a device, and it is the same device.**
`auth.welcome.guestReassurance` already tells them exactly this ("si lo
perdés, se pierde con él"). Claiming recognition we cannot perform would be a
lie; loading what is on the device is not. When that guest later signs in,
§10.15 already rules: the local profile stays untouched, side by side.

#### UI

- **A confirmation modal on sign-out, shown only when there is unsynced local
  data and Drive is not connected.** With Drive connected, sign out directly —
  there is nothing at risk to warn about. Built on `ConfirmDialog` (§10.14);
  it must not reimplement overlay behaviour.
- The copy names the real quantity ("N movements exist only on this device"),
  and the primary action signs out **keeping** them.
- **A "delete stored data" control, shipped visibly inert this wave** (user
  decision: visual now, real later), carrying its `STUB` with what the real
  thing needs. It is the answer to the borrowed-device case, and it stays an
  explicit, secondary, destructive choice — never the default and never a side
  effect of signing out.

#### Data touched

The vault (invalidated on logout), the profile registry (one additive field).
**No `schema.ts` change.**

#### Edge cases

Signing out with no vault (the common case — nothing to invalidate); signing
out while offline (it is a local operation and must work); a guest (no
sign-out control at all); a vault whose invalidation fails (the sign-out must
still complete — it must never trap the user inside an account because storage
misbehaved).

#### Done when

With a PIN set, signing out and entering the correct PIN reaches
`WelcomeScreen`, not the old account. Two Google accounts on one device
resolve to two profiles, and signing back in returns the right one. The modal
appears only in the unsynced-and-unlinked case. The delete control is visibly
unavailable and cannot be mistaken for armed.

#### Blast radius

`authStore.ts`, `lockStore.ts`, `pinLock.ts` (invalidate, not restructure),
`src/lib/profiles/`, and `src/features/profile/`. No screens beyond the
profile sheet, no schema change.

### 10.21 Coming back — the returning-user entry screen

Written 2026-08-19 (user observation). **Not implemented.**

- **Goal:** a person who has used the app for months and reopens it never sees
  the first-run screen. Seeing it reads as "everything reset", which is the
  single worst thing a finance app can imply.
- **User story:** I open the app, my Google session happens to have lapsed,
  and instead of a welcome-to-the-app pitch I see my own name and one button
  to continue.

#### When it shows, and how we know

The signal already exists and is **already read at exactly this point**:
`restore()` consults the device login marker before attempting silent
re-auth. After §10.20 the profile registry also holds the account's `label`,
so the screen can greet the person by name rather than generically.

| Device state                                | What renders                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Login marker present, silent re-auth failed | **This screen**                                                                                       |
| No marker (genuine first visit)             | `WelcomeScreen`, unchanged                                                                            |
| Signed out deliberately                     | `WelcomeScreen` — §10.20 clears the marker, and someone who chose to leave should get the full screen |

#### UI

One purpose, nothing else: get this person back in.

- Greets by name from the registry.
- **One primary action**, "continue with Google". A secondary "use another
  account" is acceptable; the guest option, the value proposition and the
  first-run legal copy are **not** — this person accepted all of that months
  ago and repeating it is what makes the app feel reset.
- **The reassurance line is the entire point of the screen** and therefore
  must be true. The marker only proves a session once existed, **not that data
  survived** — a browser can evict IndexedDB. So either gate the line on local
  data actually being present, or word it so it stays true either way. A
  screen that says "your data is still here" over an empty store is precisely
  the dishonest-UI defect §11 has already ruled on twice.

#### Edge cases

Offline (§10.11 already lets a returning user in from the marker — this screen
must not appear in front of that path and block it); a returning **guest**,
who has local data and no account (see below); a marker present but the
registry empty, where the greeting degrades to no name rather than a blank.

#### Done when

A returning user whose silent re-auth fails sees their own name and one
button, never the first-run pitch — and the reassurance it shows is verifiable
against the local store rather than assumed.

#### Blast radius

`src/features/auth/**` and one branch in the boot path. No schema change, no
new store.

#### Related, and now unblocked

A returning **guest** hits the same wall for a different reason: guest mode is
in-memory only, so reopening drops them to `WelcomeScreen` with their local
data intact but invisible. §10.10 recorded that persisting guest mode was
blocked on there being a way out of it, and §10.18 built that exit — so it is
unblocked, and this screen is its natural home. Decide the two together.

### 10.22 The category picker — assigning a category, and what a category _is_

Wave 4, Track G1. Written 2026-08-19 after auditing what the codebase already
assumes about categories; decisions confirmed with the user the same day.
**Not implemented.**

This spec is unusually decision-heavy for a picker, and that is the point: the
picker is where four things the codebase has so far only _implied_ about the
taxonomy become load-bearing. `AGENTS.md` says the expensive defect shape is
two tracks inventing two conventions — Track F (movement sheet), Track G2
(settings) and Track H (groups) all read the taxonomy, so the convention is
settled here, once, before any of them start.

- **Goal:** a movement can be given a category, and a user can create a
  category that is genuinely theirs — with its own name, icon and color —
  without leaving the sheet they are in.
- **User story:** I am recording a gym payment. "Gimnasio" is not in my list,
  so I type it, the app offers a dumbbell and a color, and I save — the
  expense is filed and the category exists from then on, on every screen.

#### The four things the codebase currently assumes, and what is actually true

Audited against the code, not against the docs:

1. **`Movimiento.categoria` holds a display _name_** (`'Comida'`) — required
   by `movimientoView.ts`'s `CATEGORY_TINT`/`CATEGORY_ICON` (keyed by name),
   `BreakdownCard` (renders `entry.key` as the visible label),
   `SearchScreen`'s tag filter, and `MovimientoRow`'s `nota || categoria`
   fallback. `repo.fake.ts` seeds names.
2. **`Movimiento.seccion` holds an _id_** (`'sec_personal'`) in both
   `repo.fake.ts` and `repo.contract.ts` — **contradicting its own comment in
   `schema.ts`** ("valor de la taxonomía (Personal, Trabajo…)").
3. **`repo.contract.ts` seeds `categoria: 'cat_sueldo'` — an id** — so the two
   fixtures in the repo disagree with each other about what the field holds.
   Nothing catches it because the contract suite never renders.
4. **`Categoria` has no icon and no color field.** Every category color in the
   app today comes from a hardcoded, Spanish-name-keyed table in
   `movimientoView.ts`. A user-created category therefore _cannot_ have a
   color — it falls back to the type tint (§10.8's edge case). The design's
   "Custom tag modal" (`docs/ui/implementation-plan.md`) asks for an icon grid
   and a color grid that have nowhere to be stored.

Two of these are shipped defects, not just untidiness:

- **The CSV export writes `seccion` raw** (`src/lib/export/csv.ts`), so a
  user's downloaded backup today has a human-readable `categoria` column next
  to a `sec_personal` column. §10.12's whole point is a file a person can
  open and understand.
- **`breakdownBy(…, 'seccion', …)` would render `sec_personal` as a visible
  label.** No screen calls it with `'seccion'` yet; Track H ("Áreas") is the
  one that will.

#### Decision 1 — a movement references a category by **id**, and the name is resolved for display

`Movimiento.categoria` stores `Categoria.id`; `Movimiento.seccion` stores
`Seccion.id` (which it already does). Display names are resolved through
`Config` at render time.

**Why not keep storing names (the cheaper option):** a rename would leave
every past movement filed under the old name — the breakdown would grow a
second "Comida" bar beside "Alimentación" — and the only fix would be
rewriting the user's whole history, which under §10.19's op log means
re-emitting an operation per movement and re-uploading years of shards to
rename one word. An id makes rename a one-field `Config` write.

**What this costs, stated honestly, because it is the expensive half:**

- Every render site that today reads `m.categoria` as a label must resolve it:
  `movimientoView.ts`, `BreakdownCard.tsx`, `MovimientoRow.tsx`,
  `SearchScreen.tsx` (its tag filter and its free-text match),
  `FilterSheet.tsx`, `csv.ts`. That is a **sweep, and it is in scope** — a
  half-migrated reference is worse than either end state.
- `repo.contract.ts` and `repo.fake.ts` fixtures must be made consistent with
  each other and with the decision.
- Under §10.19, `config-<device>.json` and the movement shards are separate
  files, so a device can hold movements whose category has not arrived yet.
  This must degrade to the type-based fallback §10.8 already specifies, never
  to a raw `cat_a1b2` on screen.

**Why now and not later:** `repoProvider.getRepo()` still returns the fake
repo, so **there is no real user data anywhere**. This is the last moment the
change costs a sweep instead of a migration on someone's money.

**`seccion` is not picked, it is derived.** Choosing a category sets both
fields: `categoria = cat.id`, `seccion = cat.seccionId`. The create sheet has
no section control (it has none in the design either), and there must not be
two ways to set the same fact.

#### Decision 2 — icon and color become real fields on `Categoria`

```ts
export interface Categoria {
  id: string
  nombre: string
  seccionId: string
  tipo: TipoMovimiento
  icono?: CategoryIconKey // NEW — a key from a curated allowlist, never a component
  color?: IconAvatarTint // NEW — reuses the existing tint families
  archivado?: boolean // NEW — see Decision 5
  presupuesto?: number
}
```

**Additive and optional ⇒ no `SCHEMA_VERSION` bump** (`schema.ts`'s own rule:
bump only on rename/split/delete). `AGENTS.md` says additive fields go through
`extra` first — **that route is unavailable here**, because `Categoria` has no
`extra` field; adding one is itself an additive change and a strictly worse
one, since icon and color are permanent first-class attributes, not a
migration escape hatch. Recorded as a deliberate, reasoned exception.

`icono` is a **string key**, not a `LucideIcon` — it is serialized to JSON in
Drive. A new `src/features/tags/categoryIcons.ts` owns
`CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon>`, the curated grid the
modal renders and the only set a stored value may resolve to. An unknown key
(hand-edited Drive file, older/newer build) falls back rather than throwing.

**`CATEGORY_ICON` and `CATEGORY_TINT` in `movimientoView.ts` are deleted.**
Their pairings move onto `CONFIG_SEMILLA.categorias` and `repo.fake.ts`'s demo
categories as explicit `icono`/`color` values. This is the real win of the
change, beyond the picker: today a category's color lives in a hardcoded table
keyed by Spanish names in an app shipping `en` and `pt-BR`, and a
user-created category can never have one. After this, color is a property of
the category, resolution is one function, and the fallback is one rule.

`getMovimientoVisual` becomes a resolution with exactly three steps, in order:
the category's own `icono`/`color` → nothing → the `tipo`-based fallback
(`FALLBACK_ICON`/`FALLBACK_TINT`, unchanged). No name-keyed lookup survives.

#### Decision 3 — the picker orders by `tipo`, it does not filter by it, and it never changes the toggle

`Categoria.tipo` is documented as "the default type when this category is
chosen" — a default, not a constraint. So:

- All non-archived categories are shown; the ones matching the sheet's current
  `tipo` sort **first**. Nothing is hidden — a category legitimately used both
  ways stays reachable.
- Choosing an `ingreso` category while the sheet says `gasto` **does not flip
  the toggle**. Flipping it changes the sign of a person's money as a side
  effect of a tap they made for another reason; the ordering above already
  makes that tap unlikely.

#### Decision 4 — "create from query" opens the modal pre-filled; it never creates silently

Typing a query with no match shows a create affordance. Tapping it opens the
category modal with the name pre-filled and an icon/color already suggested
(Decision 7), so saving is one tap — but both are visible and changeable
before saving. A silent instant-create is what produces the colorless,
wrong-section category this spec exists to prevent.

The new category's `tipo` is inherited from the sheet's current toggle — the
context is unambiguous, so it is not asked for.

Its **`seccionId` is asked for** (user decision, 2026-08-19), defaulting to
the section with the lowest `orden`, with the control hidden entirely when
only one section exists. **This is a deliberate addition to the design
canvas**, whose Custom tag modal has only name/icon/color: `seccionId` is
required and silently filing a work expense under "Personal" is a false
statement about someone's money. The canvas catches up to the code here.

#### Decision 5 — a category in use is archived, never deleted

Hard-deleting a category referenced by movements orphans them — the exact
failure the id reference is meant to avoid. So `archivado?: boolean`: an
archived category disappears from the picker, still resolves for display in
history, and can be restored.

A category **never used by any movement** may be deleted outright.

Implementation of the delete/archive UI is **Track G2's** (the "Personalizar"
settings list). The _semantics_ are fixed here so G2 does not invent a second
answer.

#### Decision 6 — the seed categories' names are localized at seed time, then they are user data

`CONFIG_SEMILLA` ships "Sueldo", "Servicios", "Impuestos"… A first run on a
`pt-BR` device seeds a Portuguese-speaking user a Spanish taxonomy. Category
names are **user data and are never translated at render time** — but the
_seed_ is the app's own copy, and `buildSeedConfig()` already varies by region
for `monedaPrincipal`. It gains the same treatment for the seed category and
section names, resolved once at seeding.

#### Decision 7 — suggesting an icon and a color, offline, without translating anything

**Translation is rejected, not deferred.** Translating the user's typed name so
it can be matched needs a translation API, i.e. a third party over the network:
it breaks §6 (no backend, and no exception covers this), breaks the offline-
first guarantee of §3, breaks the no-CDN rule, and — decisively — would send
the user's own category names to an outside service, which is the promise the
entire architecture exists to keep. An on-device LLM (Chrome's Prompt API /
Gemini Nano) is rejected for the same reason §11 (2026-08-18) rejected it for
receipt scanning: desktop-only, missing this app's mobile target.

**The problem is inverted instead: the concept table speaks every language.**
`src/features/tags/categorySuggest.ts` holds roughly 30 concepts, each with an
icon, a tint, and **one multilingual bag of keywords** — not one list per
locale:

```ts
fitness: {
  icon: 'dumbbell',
  tint: 'rose',
  keywords: ['gimnasio', 'gym', 'academia', 'fitness', 'entrenamiento', 'musculacion', 'crossfit', 'pilates', 'yoga'],
}
```

Matching never needs to know which language was typed — "academia" resolves
whether the UI is `es` or `pt-BR`, and a user who mixes languages is handled
for free. Matching normalizes case and diacritics through
`src/features/search/searchMatch.ts`'s existing normalizer; **do not write a
second one**. Matching is on whole normalized words, not bare substrings, so
`regalo` does not match inside an unrelated word.

**The color is always the concept's tint (user decision, 2026-08-19), even
when another category already uses it.** The operator raised the cost and the
user reaffirmed the choice, so it is recorded rather than re-litigated: there
are nine tint families and a real user will exceed nine categories, so from
roughly the tenth onward several categories share a color and the list gets
harder to scan by color alone. The judgment is that "Comida is amber, Salud is
green" reading _correct_ is worth more than guaranteed distinguishability.
If scanning turns out to suffer in real use, the fallback below is already the
mechanism to switch to — this is a one-line change, not a redesign.

**When nothing matches**, there is no semantics to respect, so the icon is the
`tipo` fallback (§10.8's existing rule) and the color is the **least-used tint
among the user's current categories** — deterministic given `Config`, and it
guarantees a new unrecognized category never arrives colorless.

The suggestion is always a **visible pre-selection** in the icon and color
grids, never a silent application (Decision 4).

#### UI

Two pieces, both in `src/features/tags/**`, both composed from existing shared
components — no new primitives.

**`CategoryPicker`** — rendered _inline_ inside a sheet (Add/Edit movement,
and reusable by the Filter sheet), not an overlay of its own:

- A search input (`TextField`) filtering by name, accent- and
  case-insensitively, through `searchMatch.ts`'s normalizer.
- A wrapped grid of `TagChip`s, each with its own `icono`/`color`, ordered per
  Decision 3. Single-select in the movement sheets.
- A "create «query»" chip appearing only when the query is non-empty and
  matches nothing.
- Touch targets ≥44px come from `TagChip` unchanged (§10.5.1); the grid
  scrolls vertically inside the sheet, never horizontally.

**`CategoryFormModal`** — a `CenterModal` (per the design), create and edit in
one component:

- Name (`TextField`, autofocused), section (`SegmentedControl`, conditional
  per Decision 4), an icon grid from `CATEGORY_ICONS`, a color grid over the
  nine `IconAvatarTint` families.
- Live preview: a `TagChip` showing exactly what the category will look like.
- Save is disabled while the name is empty or a duplicate (see Edge cases).
- Uses `useOverlay`'s stack via `CenterModal` — never its own Escape/focus
  handling — and stacks correctly above the `BottomSheet` that opened it
  (§10.5.1's overlay stack is already tested for this).

Both follow the shared `animate-*` tokens; no hover-only affordance; all copy
through a new `tags` i18n namespace added to **all four** locale files
(`resources.test.ts` enforces key parity — an `es`-only namespace fails
`bun run check`).

#### Data touched

- `Categoria` gains `icono?`, `color?`, `archivado?` — additive, **no
  `SCHEMA_VERSION` bump**.
- `CONFIG_SEMILLA.categorias` and `repo.fake.ts`'s demo categories gain
  explicit `icono`/`color`.
- `Movimiento.categoria` changes **meaning** (name → id) with no type change.
  `schema.ts`'s comments on both `categoria` and `seccion` are corrected in
  the same change — the current `seccion` comment is already wrong.
- Writes go through **`dataStore`**, never `repo.updateConfig` directly
  (§10.13 is the one write path). `dataStore` gains `upsertCategoria` /
  `archiveCategoria` / `deleteCategoria`, built on the existing `runMutation`
  convention — see the first edge case for why these are actions and not
  `updateConfig({ categorias: [...] })` at the call site.

#### Edge cases

- **Two categories created in the same tick.** `updateConfig({ categorias:
[...config.categorias, nueva] })` computed at a call site is a
  read-modify-write on a stale array — the exact race §11 (2026-08-18) already
  recorded and fixed inside `repo.local.update()`, reappearing one layer up.
  The new `dataStore` actions must build the array from the freshest store
  state _inside_ the `set`, not from a value captured before an `await`.
- **A movement whose category id is not in `Config`** (config shard not pulled
  yet, hand-edited Drive file, a category deleted on another device): renders
  the `tipo` fallback icon/tint and a neutral "sin categoría" label — never a
  raw id, never a blank, never a crash.
- **Duplicate name.** Compared trimmed, case- and accent-insensitively,
  **scoped to the section** — "Transporte" may legitimately exist in both
  Personal and Trabajo. Blocked inline in the modal (`aria-describedby`, per
  §10.14), never as a toast.
- **Empty / whitespace-only name**, and a name long enough to break the chip:
  trimmed; length capped, with the cap enforced on the value, not just the
  input's `maxlength`.
- **A category with no `icono`/`color`** (every seed category before this
  change, and anything a future import produces) resolves through the
  `tipo` fallback — this is §10.8's existing rule, unchanged.
- **An unknown `icono` key or an invalid `color`** read from Drive falls back
  and the record is kept; it is never dropped and never written back
  "corrected" (§10.19: unknown input is ignored and left untouched).
- **Creating a category while offline**: it is a `Config` write, so it goes
  through the same §10.11 window policy as any other mutation — no special
  case, no second policy.
- **The last category cannot be archived** if it would leave the picker empty
  and a movement uncreatable.

#### Known gap this spec surfaces but does not close

**Under §10.19, a `config` operation carries the _whole_ `Config` as one
payload** (`outbox.ts`'s `{ entity: 'config'; op: 'put'; payload: Config }`).
Two devices each adding a category while offline will therefore replay as two
whole-config `put`s and the later one wins — **silently losing the other
device's category.** Movements do not have this problem, because each one is
its own op.

This is unreachable today (no sync engine exists) and it is **Track Z's or a
follow-up's problem, not G1's** — solving it means a finer-grained config op,
which is a change to the sync format. Filed to §12 rather than fixed here.

#### Done when

- A movement can be given a category from the picker, and the created
  `Movimiento` carries `categoria = cat.id` and `seccion = cat.seccionId`.
- A category created from the picker appears immediately in the picker, on
  `MovimientoRow`, in the History breakdown and in the Search filter, **in its
  own icon and color** — not the type fallback.
- Typing "gimnasio", "gym" or "academia" all pre-select the same icon and
  color, with the app in any supported locale.
- Renaming a category in `Config` changes its label everywhere in history,
  with no movement rewritten.
- A movement referencing a missing category renders the fallback and a
  "sin categoría" label — proven by a test, not by inspection.
- `CATEGORY_ICON`/`CATEGORY_TINT` no longer exist; `rg 'CATEGORY_TINT' src`
  returns nothing.
- The exported CSV shows category and section **names**, not ids.
- The `tags` namespace exists in all four locale files.
- `bun run check` is green.

#### Blast radius

Wider than a picker, and deliberately so — the reference migration cannot be
half-done.

**Owned by Track G1:** `src/features/tags/**` (new), `src/lib/schema.ts`
(additive fields + the two corrected comments), `src/lib/dataStore.ts` (three
new actions), `src/components/shared/movimientoView.ts`,
`src/components/shared/MovimientoRow.tsx`,
`src/features/history/BreakdownCard.tsx`,
`src/features/search/SearchScreen.tsx`, `src/features/search/FilterSheet.tsx`,
`src/lib/export/csv.ts`, `src/lib/repo.fake.ts`, `src/lib/repo.contract.ts`,
`src/lib/seedConfig.ts`, the four locale files, `src/routes/Kit.tsx`.

**Explicitly NOT touched:** `repo.ts` / `repo.local.ts` / `db.ts` (no storage
shape change — `[seccion+fecha]` indexes keep working, the values are still
strings), `bootstrap.ts`, `drive.ts`, anything under `src/features/auth`,
`lock` or `profile`, and `repoProvider.getRepo()`'s stub, which stays a stub.

**Conflict check against Track Z (the other stage-1 track):** Z owns
`repo.drive.ts` (new), the sync engine, `bootstrap.ts` and §4. The only
overlap is `outbox.ts`'s config-op shape, which G1 reads and **does not
modify** — it files the gap above to §12 instead. No shared writable file.

**TDD is required** for the resolver and the `dataStore` actions
(`AGENTS.md`: money-adjacent and store-mutation code) — the failing test
first, and it must be watched failing for the right reason.

### Wave 3 — staging and dependencies

Not everything runs in parallel. A track in a later stage is **blocked** until
every track in the previous stage has merged **and passed its code review** —
not merely merged (`AGENTS.md` § Review protocol).

**Stage 1 — five tracks, fully parallel (no shared files):**

| Track | Spec   | Owns                                                                                                                         |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| R     | §10.11 | `authStore.ts`, `lockStore.ts`, `pinLock.ts`, a new network store, the shared `errorCopy`, the three screens' error branches |
| S     | §10.12 | the export module + tests — **no UI trigger this wave** (§10.18 wires its button), which is what keeps it off `Kit.tsx`      |
| U     | §10.14 | `src/components/ui/**` (additive), the new shared form/confirm components, `Kit.tsx`                                         |
| V     | §10.15 | `db.ts`, the profile registry, `repoProvider.ts` — **scoping and registry only**                                             |
| W     | §10.16 | `vite.config.ts`, a small SW registration module                                                                             |

**Stage 2 — blocked on stage 1:**

| Track | Spec   | Blocked by | Why                                                                                                           |
| ----- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| T     | §10.13 | **R**      | the write path must enforce §10.11's offline window **in one place**, so R's network store has to exist first |
| X     | §10.17 | **S**      | the diagnostics log exports through S's download mechanism. Cuttable — drop it first if the wave is too big   |

**Stage 3 — blocked on stage 2:**

| Track | Spec   | Blocked by  | Why                                                                                           |
| ----- | ------ | ----------- | --------------------------------------------------------------------------------------------- |
| Y     | §10.18 | **V, U, T** | it lists V's profiles, uses U's controls, and shows preferences the write path (T) makes real |

**The `repoProvider` stub flip is NOT in this wave, and that is deliberate.**
§10.15 ships the scoping and registry so data is separated correctly from day
one, but flipping `getRepo()` from the fake repo to the real dexie one would
leave the app **showing an empty screen with no way to add anything** — no
create UI exists until Wave 4's Track F. The flip is gated on either that
sheet existing or an explicit decision to seed the local store. Sequencing it
here would produce a technically-correct, unusable app.

### Wave 3 — what to cut if the wave is too big

The staging above is the plan; this is the trim order. Cut **§10.17
diagnostics** first (no dependent, no promise behind it), then **§10.16 SW
update** (cheap, but nothing breaks until a deploy lands on an open tab), then
**§10.12 CSV export** — it moved down once it stopped being the data-safety
answer (see §11, 2026-08-19); it is now a genuinely useful convenience rather
than a gap between promise and code. What should not be cut: **§10.11
offline**, which closes a claim `specs.md` §3 has made since the beginning;
**§10.13 write path** and **§10.14 form primitives**, the "build once so three
Wave 4 tracks share it" move that already paid off with the Toast; and
**§10.15 / §10.18**, which make local data correct and reachable.

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

- 2026-08-18 — **Track A file layout: `repo.local.ts` / `repo.local.test.ts`
  as new siblings of `repo.ts`, not an extension of it.** Confirms the
  operator's assignment: `repo.ts` stays the frozen port; the dexie-backed
  implementation is `createLocalRepo()` in a new file, symmetric with Track
  D's `repo.fake.ts`. Neither implementation pollutes the port file.
- 2026-08-18 — **`RepoErrorCode` gained `'invalid_input'` (additive).** The
  §10.3 write-validation rule ("`monto` > 0 and finite … → `RepoError`,
  never a silent coercion") needs a code distinct from `not_found` /
  `schema_mismatch` / `network` / `unknown` so a caller can branch on "bad
  input" vs. "unexpected failure." `Repo`/`CrudRepo`/`ListQuery`/
  `ListResult`/`RepoError`/`EntityId` shapes are unchanged; no consumer
  existed yet (grepped before changing), so this cannot break Track D's
  `repo.fake.ts` or any other in-flight track — flagged to the operator at
  the time via `SendMessage`.
- 2026-08-18 — **Bulk writes (`addMany`/`removeMany`) are all-or-nothing.**
  Both run inside one `db.transaction('rw', table, …)`; any failure (bad
  validation, a duplicate id, or — for `removeMany` — a missing id) aborts
  the whole batch, never a partial commit. Chosen over partial-success
  because a half-committed financial import is worse than a fully-rejected
  one: the caller has no way to know which rows landed. Verified directly
  (a duplicate-id item in a 3-item `addMany` leaves 0 of 3 committed).
- 2026-08-18 — **`db.ts` bumped to `v2`, additive.** `vault` (`v1`) is
  untouched; `movimientos`/`activos` get `id, fecha|fechaActualizacion,
seccion, [seccion+fecha|fechaActualizacion]` and `config` gets `id`
  (single-row, same fixed-id pattern as `vault`). Indexes were chosen to
  serve `ListQuery`'s actual filter shapes (`seccion` exact match, date
  range, and the two combined via the compound index). **Superseded same
  day** (see the fast-path entry below): `createdAt` ended up indexed after
  all, compounded with the date field (`[fecha+createdAt]` /
  `[seccion+fecha+createdAt]`), once the first cut's always-in-memory
  `list()` turned out not to deliver the bounded-read scalability §10.3
  asked for. Full rationale in the code comment above `db.version(2)`.

- 2026-08-18 — **`list()` gained a real bounded-read fast path** — the
  original implementation always materialized the whole matching set in
  memory before slicing, which defeated §10.3's own stated reason for
  building filtering/pagination into the port ("avoids a breaking change
  once 'load everything into memory' stops being viable" — the
  implementation was still doing exactly that). Fixed by adding a
  compound-index-driven fast path (`tryFastPath` in `repo.local.ts`) for
  the common case — `sortBy` is the entity's own date field, `limit`
  given — that reads a bounded window directly off the index; the
  original in-memory implementation (`listSlow`) stays as the documented
  fallback for an arbitrary `sortBy` or an omitted `limit`. `db.ts` v2's
  `movimientos`/`activos` stores gained `[fecha+createdAt]` /
  `[fechaActualizacion+id]` and their `seccion`-prefixed variants to make
  this possible (v2 amended in place, not bumped to v3 — nothing had
  shipped/merged against it yet). Full mechanism, the `TIE_SAFETY_MARGIN`
  bail-out, and how it was proven (not just asserted) are in §10.3.1.
- 2026-08-18 — **`sortDir` now applies uniformly across the whole sort key
  (primary field, tiebreak field, final `id` fallback), not just the
  primary field.** The original design ("primary field respects `sortDir`;
  tiebreak and `id` are always ascending") was a real, reproduced bug once
  the fast path shipped: a dexie compound-index range query with
  `.reverse()` for `desc` reverses the _entire_ lexicographic key — primary
  field and tiebreak component together — so a mixed-direction convention
  can't be expressed as a single contiguous index range scan, and the two
  disagreed on which side of a keyset cursor a tied row fell on. Concretely:
  a row inserted with an earlier `createdAt` than an already-returned,
  same-`fecha` row was dropped from the following page under the old
  convention. Switching to "reverse means the whole order reverses" is also
  the more conventional multi-key-sort semantics (matches `ORDER BY a DESC,
b DESC`, not a mix) and made the fast path's range-bound construction
  provably correct instead of relying on it. The three `repo.local.test.ts`
  cases whose expectations depended on the old convention were updated to
  match (documented in their own test descriptions/comments, not just the
  diff).
- 2026-08-18 — **`enableLock` now sets `activeDek` itself (fix, code review).**
  Root cause of a latent bug: `enableLock` wrote the vault but never populated
  the module-level `activeDek`, so a tab that had just turned the lock on had
  no working `updateSession` until a separate PIN/biometric unlock happened —
  any `syncLockedSession` call in that window threw `'lock: not unlocked'`,
  and (before the next fix below) that error vanished into a bare `catch {}`,
  leaving the vault holding a stale session. Fixed at the root: enabling the
  lock is conceptually the same act as unlocking it (the user just proved
  knowledge of the PIN by setting it), so `enableLock` now assigns the freshly
  generated DEK to `activeDek` right after writing the vault — a freshly
  enabled lock behaves exactly like a just-unlocked one. TDD'd in
  `pinLock.test.ts` (`enableLock leaves the vault unlocked in this tab, no
separate unlock needed` — failed with `Error: lock: not unlocked` pre-fix).
- 2026-08-18 — **`syncLockedSession`'s try covers the whole body, and its
  catch logs instead of swallowing silently (fix, code review).** Two related
  bugs: (1) `hasVault()` sat outside the `try`, so an IndexedDB failure there
  (Safari private mode, storage-quota errors, a blocking extension) threw
  straight into the caller's catch and failed `login()`/`restore()`/
  `hydrate()`/`connectDrive()` even though the identity auth itself had
  succeeded — moved the `hasVault()` read inside the same `try` so the whole
  function is genuinely best-effort, matching what its own comment already
  promised. (2) With the `enableLock` root cause fixed above, a thrown
  `'lock: not unlocked'` (or any other vault error) is now genuinely
  unexpected rather than an every-time occurrence — a bare `catch {}` would
  hide a real problem with no trace. Chose to keep the auth flow
  un-breakable (never re-throw — a stale cache is a lesser bug than a broken
  login) but log via `console.warn` so the failure is visible in devtools
  instead of disappearing. TDD'd in `authStore.test.ts` (`does not throw or
block login when hasVault itself fails` — failed with `status: 'error'`
  pre-fix).
- 2026-08-18 — **`restore()` wired into `RequireAuth` for the no-lock boot
  path, closing the "silent re-auth while the Google session is alive"
  promise in §5 (fix, code review).** `restore()` (identity-only, `prompt:
''`, already implemented and unit-tested) had zero production callers —
  every reload forced a manual "Continuar con Google" click regardless of
  whether the Google session cookie was still alive. Wired it into
  `RequireAuth`'s mount effect, gated to fire only once and only when
  `status === 'idle'`. That guard is also what keeps it from racing
  `AppLock`/`lockStore.resume()`: when a PIN lock is enabled, `AppLock`
  withholds `RequireAuth` behind `LockScreen` until `resume()` has already
  settled `status` to `'authenticated'` or `'error'` via `hydrate()` — it
  never leaves `status` at `'idle'` — so by the time `RequireAuth` first
  mounts in that path, the idle-gate is already closed and `restore()`
  doesn't fire. Only the true cold-boot-with-no-lock case (`status` still
  `'idle'` when `RequireAuth` mounts) triggers it, and its existing silent
  fallback to `'idle'` on failure is unchanged, so a logged-out visitor with
  no live Google session still lands cleanly on `WelcomeScreen`. Added a
  second guard directly in `authStore.restore` itself (`if (get().status !==
'idle') return`, flipping to `'authenticating'` synchronously before the
  first `await`) as defense in depth against a double-invoke (e.g. React
  StrictMode) firing it twice. TDD'd in both `authStore.test.ts` (`is a
no-op when status is not idle...`) and `RequireAuth.test.tsx` (`attempts a
silent restore once on mount while status is idle` / `does not attempt a
silent restore when a lock-screen unlock already settled status`).
- 2026-08-18 — **`connectDrive` now guards against a stale in-flight resolve
  resurrecting a logged-out session (fix, code review).** Its success path
  unconditionally `set` the resolved session/drive/driveOptIn with no check
  that the store was still in the state it started from — a `logout()`
  landing while the Drive-scope request was in flight would be silently
  undone by the late resolve (not reachable today, no logout button is wired
  anywhere yet, but latent). Fixed with a module-level `authGeneration`
  counter that `logout()` increments; `connectDrive` snapshots it at the
  start and checks it's unchanged before applying either the success or the
  error branch, discarding the resolve otherwise. Chose a dedicated counter
  over checking `status`/`session` directly because `connectDrive` doesn't
  otherwise touch `status`, and piggybacking the guard on an unrelated field
  would make the check fragile to reorder. TDD'd in `authStore.test.ts`
  (`does not resurrect a logged-out session with a stale in-flight resolve`
  — failed with the stale session/drive resurrected pre-fix).
- 2026-08-18 — **Locking now discards the resident DEK, closing the gap the
  `activeDek` fix above widened (fix, code review follow-up).** `lockStore`'s
  `lock: () => { if (get().enabled) set({ phase: 'locked' }) }` was a pure UI
  state flip — `activeDek` was only ever cleared by `resetVault()`, never by
  re-locking, on either the manual "Lock now" path or the 7-minute
  background-timeout re-lock in `onVisible`. A "locked" tab still held the
  key that decrypts the cached OAuth token resident in module memory: the
  curtain was up but the key was still in hand. §5's threat model is casual
  access, not a forensic attacker, but "the key is discarded on lock" is the
  one-line property that makes the curtain mean anything, and the
  `enableLock`/`activeDek` fix above made the vault carry a live DEK in
  strictly more situations than before it, not fewer — so this needed
  closing in the same pass. Added `pinLock.forgetDek()` — an explicit
  exported operation, not a raw `activeDek = null` reached into from
  `lockStore` — so key material stays owned by the module that created it;
  `resetVault` now calls it too instead of duplicating the assignment.
  Wired into every route `lockStore` has into the locked phase: the manual
  `lock()`, the background-timeout re-lock in `onVisible()`, and (for the
  invariant "phase locked ⇒ no DEK resident" to hold unconditionally, not
  just because a fresh module load happens to start `activeDek` at `null`)
  the cold-start path in `init()` too. The `LockedOutError` branch in
  `resume()` and the manual `reset()` path were already covered — both call
  `resetVault()`, which now routes through `forgetDek()`. Verified the
  composition with the `syncLockedSession` change from the previous entry:
  a token refresh attempted in a locked tab now legitimately throws `'lock:
not unlocked'` and hits the `console.warn` path — correct, not a
  regression — and confirmed (a) nothing in the codebase calls
  `login`/`restore`/`hydrate`/`connectDrive` on an interval or proactive
  refresh timer (grepped for `setInterval`/`expiresAt` scheduling — none
  exists), so this can't become a noisy warning loop, and (b) unlocking
  again after a `forgetDek()` still fully restores a usable, refreshable
  session (`unlockWithPin`/`unlockWithBiometric` re-populate `activeDek`
  exactly as before). Also added an explicit test pinning down that
  `syncLockedSession`'s `console.warn` never carries the access token (it
  only ever logs the caught error, never the `session` argument) — specs.md
  §7 is absolute on this, worth checking rather than assuming. TDD'd in
  `pinLock.test.ts` (`forgetDek discards the in-memory key so updateSession
requires a fresh unlock`, `unlocking again after forgetDek restores a
usable, refreshable session` — the first failed with `forgetDek is not a
function` pre-fix) and `lockStore.test.ts` (`init forgets any DEK before
landing on the locked phase`, `lock re-locks only when enabled` extended
  to assert `forgetDek`, `onVisible re-locks after background expiry`
  extended likewise, plus a negative case that a not-yet-expired
  `onVisible` leaves the DEK untouched — all three failed on the missing
  `forgetDek()` call pre-fix).
- 2026-08-18 — **`repo.fake.ts` brought into parity with `repo.local.ts` on
  eight reproduced divergences (code review, Track D).** All eight (plus a
  ninth clock issue found on the same pass) had a failing test written
  first, confirmed to fail for the stated reason, then fixed:
  1. `list()` with no `sortBy` now defaults to the entity's own date field
     (`fecha`/`fechaActualizacion`) instead of insertion order — the
     seeded data happened to already read newest-first by insertion order,
     which is why this was invisible until a row was appended out of that
     order in a test.
  2. Default `sortDir` flipped from `'asc'` to `'desc'`, matching
     `repo.local.ts`.
  3. `validateMovimiento` now checks `!Number.isFinite(m.monto) ||
m.monto <= 0` (was `m.monto <= 0` alone, which lets `NaN` through since
     `NaN <= 0` is `false` in JS).
  4. `activos` now has a `validateActivo` (was unvalidated entirely):
     ISO `fecha` format, `moneda` required, `valorActual` finite and
     non-negative (zero explicitly allowed — an asset can be worth
     nothing).
  5. Sort ties now break via a three-level comparator (sort field →
     per-entity tiebreak field → `id`) ported from `repo.local.ts`'s
     `makeComparator`, with `sortDir` multiplied uniformly across all three
     levels — reusing the exact fix from the entry above rather than
     reintroducing the mixed-direction bug it corrected.
  6. `updateConfig` now rejects a patch that sets `schemaVersion` with
     `RepoError('invalid_input')` instead of silently applying it (which
     used to desync the fake's own `ready()` version check from
     `FAKE_CONFIG`, throwing `schema_mismatch` on every later call for a
     reason nothing pointed back to).
  7. A malformed or negative pagination cursor now throws
     `RepoError('invalid_input')` instead of `Number('garbage')` → `NaN` →
     `slice(NaN)` silently behaving like `slice(0)`. The index-encoded
     cursor shape itself is unchanged (§10.5 names this as the one
     deliberate simplification vs. `repo.local.ts`'s opaque cursor).
  8. `update()` now re-pins `id` (`{ ...existing, ...patch, id }`) so a
     patch can never change an entity's id.
  9. (Found during the same pass, not in the original list.) The exported
     `fakeRepo` singleton — the instance §10.5 says every Wave 2 screen
     should import — defaulted through `createFakeRepo()`'s bare
     `new Date()`, so its seeded relative dates silently drifted with
     whatever real day the app happened to boot on. Pinned it to a fixed
     `FAKE_REPO_SEED_DATE` (`2026-08-18`) instead; `createFakeRepo()`'s own
     `today` parameter still defaults to `new Date()` for ad-hoc/isolated
     use, only the shared singleton is pinned. Proven with a test that
     re-imports the module under two different mocked system clocks and
     asserts the seed comes out identical either way (a same-file dynamic
     `import()` after `vi.resetModules()`, since the singleton evaluates
     once at module load).
     `get`/`add`/`addMany`/`update` were also changed to return fresh shallow
     copies rather than references into the fake's internal `store` array —
     not itself one of the eight, but required by the same "must never hand
     out a mutable reference" rule the task brief stated, and `list()`'s
     sorted output was already copy-safe only at the array level, not the
     item level, before this pass.

  **A further divergence spotted on this pass — resolved same-day, not left
  open:** `repo.local.ts`'s `validateMovimiento` also checks `fecha` is a
  valid ISO `yyyy-mm-dd` and that `moneda` is present; `repo.fake.ts`'s
  `validateMovimiento` only ever checked `monto`. Flagged to the operator
  rather than folded in silently (per the review brief); the operator
  confirmed it's the same divergence class as #4 (`activos`) and asked for
  it to be fixed. TDD, same as the eight above: added failing tests first
  (`rejects an invalid fecha on a Movimiento` — bad format `'not-a-date'`
  and three impossible calendar dates `'2026-13-40'`/`'2026-02-30'`/
  `'2023-02-29'`; `rejects a Movimiento with missing moneda`; plus a
  positive control, `accepts a real leap day fecha` — `'2024-02-29'`, which
  already passed since `isValidIsoDate` itself was correct, only
  `validateMovimiento` never called it), confirmed both failed for the
  right reason, then added the same `isValidIsoDate`/`moneda` checks
  `validateActivo` already had — reusing the one helper rather than adding
  a second. `validateMovimiento` now checks `monto`, `fecha`, and `moneda`,
  matching `repo.local.ts` exactly.

- 2026-08-18 — **Tenth divergence resolved same-day: `add()`/`addMany()`
  now reject a duplicate `id`, and `removeMany()` now rejects a missing
  `id`.** Reported first (see previous entry), then fixed on operator
  confirmation. TDD: four failing tests added first — `add()` with an id
  already in the store; `addMany()` with an id already in the store
  (asserting the batch's _other_, otherwise-valid row also did NOT land —
  the all-or-nothing check); `addMany()` with the same id repeated twice
  inside one batch; `removeMany()` with one real id plus one missing id
  (asserting the real id was NOT removed either) — all four confirmed to
  fail for the right reason (each resolved instead of rejecting) before
  the fix. `add`/`addMany` now check for a colliding id (against the
  store, and — for `addMany` — within the batch itself) _before_ touching
  `store`, and throw `RepoError('invalid_input')`; `removeMany` now checks
  every id exists before removing any of them, throwing
  `RepoError('not_found')` on the first miss — bringing it in line with
  what `remove()`/`update()` already guaranteed for a single id, closing
  the self-inconsistency noted in the previous entry.
  **One correction to what was reported, not copied into the fix:** the
  reproduced-today `repo.local.ts` behavior for a duplicate id on `add`/
  `addMany` is `RepoError('unknown')` (a Dexie `ConstraintError` falling
  through the generic `wrapUnknown` wrapper) — the operator confirmed
  that's itself a bug in `repo.local.ts` (a duplicate id is the caller
  violating the contract, not an unexpected storage failure — the same
  distinction `invalid_input` exists for) and is having the other track
  fix it there. The fake targets the _corrected_ behavior,
  `RepoError('invalid_input')`, not the code as currently reproduced —
  matching a defect byte-for-byte would have propagated it instead of
  agreeing with the intended contract.
  **Explicit sweep result: no eleventh divergence found.** Re-swept
  `add`/`get`/`addMany`/`update`/`remove`/`removeMany`/`list`/`ready`/
  `getConfig`/`updateConfig` against §10.3's bullets and edge cases after
  this fix; nothing else stood out as disagreeing with the documented
  contract.
- 2026-08-18 — **`update()`/`remove()` made atomic (code-review fix, HIGH).**
  Both used to do `table.get(id)` then a second, unsynchronized `table.put`/
  `table.delete` call — two concurrent `update()` calls on the same id could
  both read the same stale row, each merge its own patch, and the later
  `put` would silently overwrite the earlier one's write with no error
  surfaced (reproduced: seed `monto: 100`, run
  `Promise.all([update(id,{monto:200}), update(id,{categoria:'cat_otro'})])`
  → `monto: 200` vanished). Fixed by wrapping the whole read-merge-write (and
  read-then-delete) in `db.transaction('rw', table, …)`, matching the
  atomicity `addMany`/`removeMany` already had. `remove()`'s equivalent bug
  was latent (harmless double-delete today, no data loss) but got the same
  treatment for consistency — same shape, same fix. Validation still runs
  against the **merged** result inside the transaction, unchanged.
- 2026-08-18 — **Cursor payload now carries `sortBy`/`sortDir`; a replay
  under a different one is rejected (code-review fix, MEDIUM).** `list()`'s
  cursor used to encode only `{ sortValue, tiebreakValue, id }`, with no
  record of which query minted it — replaying a cursor from
  `list({ sortBy: 'monto', sortDir: 'asc' })` against a call defaulting to
  `sortBy: 'fecha', sortDir: 'desc'` silently misinterpreted `sortValue` as
  a `fecha` bound, excluding every row and returning `{ items: [] }` —
  indistinguishable from "no data". `CursorPayload` now includes `sortBy`/
  `sortDir`; `decodeCursor` takes the current call's `sortBy`/`sortDir` and
  throws `RepoError('invalid_input')` on any mismatch. A loud error beats a
  silently-wrong empty page.
- 2026-08-18 — **`limit` is validated; `0`/negative/non-integer/`NaN`/
  `Infinity` now reject instead of silently dropping `nextCursor` (code-review
  fix, LOW).** With `limit: 0`, `page` was always `[]`, so `lastItem` was
  `undefined` and `nextCursor` got dropped even when more rows existed,
  leaving the caller stuck on `{ items: [] }` with no way to page forward.
  "Give me zero rows" isn't a meaningful pagination request, so `list()` now
  validates `limit` as a positive integer up front and throws
  `RepoError('invalid_input')` otherwise — an honest error over an ambiguous
  empty page.
- 2026-08-18 — **`ready()`'s in-flight memo moved from per-repo-instance
  closure state to a module-level `WeakMap` keyed by the `db` connection
  (code-review fix, LOW, latent).** Two `createLocalRepo()` instances over
  the same `db` used to have separate closures, so concurrent `ready()`
  calls across instances didn't dedupe — harmless while the migration
  registry is empty, but a real migration could then run twice against the
  same IndexedDB store. The memo now lives keyed by `db` itself; a resolved
  promise stays cached (`performReady()` runs once per database connection,
  per §10.3's "before first use"), and only a **rejected** attempt clears
  the entry so a later call can still retry. **Correction, same day:** an
  intermediate version of this fix cleared the memo on success too (`.finally()`
  instead of `.catch()`), reasoning it "only dedupes concurrent callers, a
  later call just re-verifies cheaply" — that traded the run-once guarantee
  away: every `list()`/`get()`/`add()`/etc. awaits `ensureReady()`, so a
  cleared-on-success memo made every single repo operation pay a fresh
  `db.config.get` round-trip, caught by operator review
  (`db.config.get` called on 3 of 3 ops after `ready()` had already
  resolved). Reverted to clear-on-rejection-only; a new regression test
  (`ready() runs performReady() exactly once per database connection, not
once per call`) pins the run-once property so this can't silently regress
  again. The test suite itself now needs `__resetReadyMemoForTests()`
  (test-only export) in `afterEach`, since its tests share one `db`
  singleton across the whole file while production expects the memo to live
  for the connection's entire lifetime.
- 2026-08-18 — **`update()`'s not-found message no longer names the date
  field (trivial code-review fix).** It rendered `no fecha entity with id
"…"` — an internal field name (`dateField`) doing double duty as the
  entity noun. `EntityConfig` gained an explicit `entityLabel` (`"movimiento"`
  / `"activo"`) used by both `update()` and `remove()`'s not-found messages.
- 2026-08-18 — **A duplicate `id` on `add()`/`addMany()` now maps to
  `RepoError('invalid_input')`, not `'unknown'` (code-review fix, surfaced
  while verifying the fake-repo track's matching fix for the fake
  implementation).** Dexie's `ConstraintError` on a duplicate primary key
  isn't a `RepoError`, so it used to fall through `wrapUnknown` unchanged —
  a UI handing over a duplicate id got an error indistinguishable from a
  genuine IndexedDB failure. `'invalid_input'` is the correct code for the
  same reason it exists at all: bad caller input (`id` must be unique) is a
  different failure mode than the storage layer breaking unexpectedly, and
  callers need to tell them apart. Detected by matching `.name ===
'ConstraintError'`/`'BulkError'` (never `instanceof` or the message
  string — see §10.3.1 for why `instanceof Error` specifically doesn't
  hold for a `BulkError`'s individual `failures`). `addMany`'s all-or-
  nothing rollback is unaffected — the transaction still aborts the whole
  batch; only the error's `code` and message changed. Alignment with the
  parallel fake-repo track: `removeMany` with a missing id stays
  `'not_found'` on both implementations (this one already did); a
  duplicate `id` is `'invalid_input'` on both.
- 2026-08-18 — **`useOverlay`'s topmost-overlay determination uses a
  render-order sequence number, not push/open order (Track D follow-up,
  §10.5.1).** A naive "last pushed to the stack = topmost" breaks for two
  overlays that mount already-open in the same commit (both effects run in
  the same commit; React runs child effects before parent effects, so the
  child/nested overlay would push first and the outer one would end up
  "on top" by raw push order — backwards). Assigning each overlay a
  monotonic `seq` at first **render** instead sidesteps this: React calls
  parent render functions before descendants', so a nested overlay's `seq`
  is always higher than its ancestor's regardless of effect-firing or
  open/close timing, making "topmost = highest `seq` among currently open"
  a stable, race-free rule.
- 2026-08-18 — **Scroll lock is refcounted against the overlay stack, not a
  single acquire/release pair (Track D follow-up, §10.5.1).** Closing a
  nested `CenterModal` while its parent `BottomSheet` is still open must
  not unlock body scroll; a plain counter incremented on every overlay
  open and decremented on every overlay close, restoring `overflow` only
  when it reaches zero, gives that for free without needing to inspect the
  stack's contents.
- 2026-08-18 — **Touch-target fix technique: an invisible-padding hit-area
  wrapper, not inflating the visible pill/icon (Track D follow-up,
  §10.5.1).** `Toggle`/`InfoButton` already used this split (outer
  `min-h-11`/`min-w-11` button, inner element at the designed visual size);
  applied the same pattern to `TagChip`, `SegmentedControl`, and
  `DateChipPicker` instead of directly bumping `min-h-9`→`min-h-11` (which
  would have grown the border/background box itself, visibly inflating the
  pill past the design).
- 2026-08-18 — **`IconAvatar` does not accept a forwarded `ref` (Track D
  follow-up, §10.5.1).** Unlike the rest of the kit, it's purely
  decorative (`aria-hidden`, no interactive semantics) — there's no
  plausible screen need to measure or focus it, so it was left out of the
  React 19 `ref`-as-prop pass rather than adding an unused capability.
- 2026-08-18 — **No `import * as React` namespace imports; named imports
  only.** `src/components/ui/button.tsx` used `import * as React from
'react'` purely to reach `React.ComponentProps` — converted to `import
type { ComponentProps } from 'react'`, matching the type-only-import
  convention already used elsewhere in `src/`. This is the one spot in the
  tree that had it; verified with `rg` across `src` for `React\.`,
  `import React`, and `JSX\.` — nothing else matched. The risk is
  reintroduction: `bunx shadcn@latest add <name>` (the documented way to
  add new `ui/` components, AGENTS.md) emits `import * as React from
'react'` as its house style, so every future generated component would
  bring it back. Enforcement: oxlint ships a real `import/no-namespace`
  rule (needs the `import` plugin, not enabled by default) that flags any
  `import * as x from 'y'` — verified it fires by temporarily
  reintroducing the namespace import and running `bun run lint` with the
  rule enabled (errored as expected), then reverting. `AGENTS.md` gets a
  rule requiring the import be normalized after every `shadcn add`.
- 2026-08-18 — **Arbitrary px values in `BottomSheet`/`CenterModal`/`Toggle`
  converted to the rem-based Tailwind spacing scale (`fix/px-units`).**
  `--spacing` is unmodified at Tailwind v4's default `0.25rem`, so every
  value converted cleanly to `px / 4`: `px-[22px]`→`px-5.5`,
  `mb-[18px]`→`mb-4.5`, `h-[5px] w-[38px]`→`h-1.25 w-9.5` (`BottomSheet`
  padding/handle); `inset-x-[26px]`→`inset-x-6.5` (`CenterModal`);
  `h-[25px] w-[42px]`→`h-6.25 w-10.5`, `size-[21px]`→`size-5.25`,
  `left-[19px]`→`left-4.75` (`Toggle` track/knob/checked-position — verified
  the three numbers still interlock: 25px track height minus 21px knob
  leaves the same 2px top/bottom gap as the existing `top-0.5`, and 42px
  track width minus 21px knob leaves 2px on the resting side either way).
  `inset-x-[26px]` happens to equal the `--radius-4xl` token (26px) but was
  **not** switched to it — it's a horizontal inset, not a corner radius, and
  the two scales only coincide by accident at that one number. `max-h-[88dvh]`
  was left untouched — `dvh` is already the relative unit the rule asks for,
  not a violation. Verified with Playwright at a 390×844 viewport: measured
  `getBoundingClientRect()` on the toggle track/knob (both checked and
  unchecked), the sheet's content inset and handle bar, and the modal's
  left/right inset before and after the edit — every measurement was
  pixel-identical (e.g. toggle knob offsets stayed 19px/2px checked,
  2px/19px unchecked; modal inset stayed 26px/26px) confirming the
  conversion is a no-op at the default root font size and now scales with
  the user's font-size preference.

- 2026-08-18 — **Error-handling standard (phase 2, `fix/errors`): shared
  `Repo` contract test suite, React error boundaries, Spanish error copy for
  auth/lock screens.** Implements `docs/error-handling.md` (adopted the same
  day, see `AGENTS.md`) against the three fixer branches
  (`fix/a-repo`/`fix/b-auth`/`fix/d-fake`) once merged to `main`. Four
  pieces:
  1. **`src/lib/repo.contract.ts`** — a plain module (not `*.test.ts`,
     per operator decision: a bare-helper test file gets collected by
     vitest as a standalone suite with no top-level test of its own)
     exporting `testRepoContract(makeRepo)`, invoked from both
     `repo.local.test.ts` and `repo.fake.test.ts`. Consolidates the
     behavior every `Repo` implementation must agree on (validation codes,
     not_found/duplicate-id codes, malformed-cursor/limit rejection,
     addMany/removeMany atomicity, default sort + tiebreak-uniform-with-
     sortDir, Config shallow-merge/schemaVersion guard/fresh-object
     reads) — asserting on `.code` only, never message text. Both
     implementation test files had their now-redundant copies of these
     same assertions removed (~50 `it()` blocks combined), keeping only
     what's genuinely implementation-specific (dexie fast-path/keyset
     mechanics, `ready()`/migration gate, the cursor's exact
     sortBy/sortDir-bound identity vs. the fake's simpler index-encoded
     one — §10.5's deliberate divergence, concurrency-race mechanics,
     message-text regressions).
  2. **The suite found two real divergences in `repo.fake.ts` on first
     run against the merged `fix/d-fake` code**, both fixed the same
     session:
     - No `limit` validation at all: `list({ limit: 0 })` returned
       `{ items: [], nextCursor: '-1' }` — the exact ambiguous-empty-page
       shape the standard's §4 warns about — where `repo.local.ts`
       correctly threw `invalid_input`. Fixed by porting
       `repo.local.ts`'s `validateLimit`.
     - `getConfig()`/`updateConfig()` returned `{ ...config }`, a shallow
       copy whose nested `secciones`/`categorias`/`preferencias` were
       still the _same_ array/object references as the live in-memory
       store — a caller mutating the returned config silently corrupted
       the fake's own state. Invisible in `repo.local.ts` only because
       IndexedDB's structured-clone boundary happens to protect every
       read there; `repo.fake.ts`'s plain in-memory variable gets no such
       guarantee for free. Fixed with `structuredClone(config)` (native
       platform API, no library).
       Both are exactly the class of bug the suite exists to catch
       structurally instead of by manual review — full detail in
       `docs/error-handling.md` §6.
  3. **React error boundaries, previously absent entirely.**
     `src/RouteErrorFallback.tsx` (react-router's own `errorElement`,
     wired onto every route in `src/router.tsx`) + `src/AppErrorBoundary.tsx`
     (a class component — the only way to catch a render throw in React —
     wrapping `AppLock`/`RouterProvider` in `src/main.tsx`, for failures
     outside the router's own tree). Both log via `console.error` and
     render a fixed Spanish fallback line, never the caught error's
     message. Both tested (including that the raw error text never
     reaches the DOM).
  4. **Spanish, actionable error copy for the four auth/lock screens**
     (`WelcomeScreen`, `DrivePermissionScreen`, `LockScreen`,
     `LockSettings`), replacing raw `error.message` interpolation (e.g.
     `"No se pudo iniciar sesión: auth: missing VITE_GOOGLE_CLIENT_ID"`
     rendered verbatim) — an untranslated, internals-leaking string in a
     Spanish UI. `src/features/auth/errorCopy.ts` and
     `src/features/lock/errorCopy.ts`: a `Record<message, spanishCopy>`
     lookup with a generic per-domain fallback for anything unmapped.
     Keyed by the error's exact message, not a formal `code` — per the
     operator's explicit instruction, `AuthError`/`DriveError`/the lock
     error classes do **not** get a speculative `code` union added just
     for this (`docs/error-handling.md` §1's "only add `code` when a
     caller needs to branch on more than pass/fail" — no caller does).
     The exact copy (operator asked to review the wording, not just the
     mechanism):
     - Login (`loginErrorCopy`, `src/features/auth/errorCopy.ts`):
       `'auth: missing VITE_GOOGLE_CLIENT_ID'` → "Error de configuración.
       Intenta más tarde."; `'auth: GIS failed to load'` → "No pudimos
       cargar Google. Revisa tu conexión e intenta de nuevo.";
       `'auth: access_denied'` → "Cancelaste el inicio de sesión con
       Google."; `'auth: popup_closed'` → "Cerraste la ventana de Google
       antes de terminar. Intenta de nuevo."; `'auth: popup_failed_to_open'`
       → "El navegador bloqueó la ventana de Google. Revisa el bloqueador
       de ventanas emergentes."; unmapped → "No se pudo iniciar sesión.
       Intenta de nuevo."
     - Drive (`driveErrorCopy`, same file, reuses the login map plus its
       own fallback): unmapped (covers every dynamic `DriveError`, e.g.
       HTTP-status messages) → "No se pudo conectar con Drive. Intenta de
       nuevo."
     - Unlock (`unlockErrorCopy`, `src/features/lock/errorCopy.ts`):
       `'locked out'` → "Demasiados intentos. Inicia sesión con Google de
       nuevo."; `'lock: wrong pin'` → "PIN incorrecto. Intenta de
       nuevo."; `'lock: biometric unavailable'` → "La biometría no está
       disponible en este dispositivo."; unmapped → "No se pudo
       desbloquear. Intenta de nuevo."
     - Enable-lock (`enableLockErrorCopy`, same file):
       `'lock: no session to protect'` → "Necesitas iniciar sesión antes
       de activar el bloqueo."; unmapped → "No se pudo activar el
       bloqueo. Intenta de nuevo."
       Two pre-existing tests (`WelcomeScreen.test.tsx`,
       `RequireAuth.test.tsx`) and one (`DrivePermissionScreen.test.tsx`)
       were asserting the _raw_ English message appeared in the rendered
       alert — i.e. tests that enforced the exact bug this item fixes.
       Updated to assert the Spanish copy renders and the raw string does
       not.
       Also, while re-verifying the three merged fixer branches against the
       standard (all confirmed compliant): `authStore.restore()`'s silent-auth
       `catch {}` turned out to be a legitimate, deliberate silent swallow (not
       a gap) — routine failure for anyone without a live Google session, with
       its own downstream error-visible path via an explicit `login()`. Gave it
       an explanatory comment and used it to add a documented exception to
       `docs/error-handling.md` §2's "never be silent" rule, since the standard
       as written didn't account for this case. `repo.local.ts`'s
       `removeMany()` not-found message also got the same `entityLabel` fix
       `update()`/`remove()` already had (cosmetic — message text isn't
       contract, `docs/error-handling.md` §8 — but inconsistent otherwise),
       with a regression test.
       `bun run check` green (283 tests) throughout; `bun run build` verified
       after the router/main.tsx changes.

- 2026-08-18 — **Closed a drift-guard gap in the Spanish error-copy mapping
  (operator review of phase 2).** `errorCopy.test.ts` (both
  `src/features/auth/` and `src/features/lock/`) previously hardcoded the
  same literal key the copy table itself uses
  (`loginErrorCopy('auth: access_denied')`), so a change to `AuthError`'s
  `` `auth: ${reason}` `` message template — dropping the prefix, renaming
  it, adding context — would make every key in the table silently stop
  matching, every user silently get the generic fallback, and the test
  suite keep passing regardless. Fixed by deriving each mapped-key test
  from the real error construction instead
  (`loginErrorCopy(new AuthError('access_denied').message)`) so a template
  change fails the build. Verified directly: temporarily changed
  `AuthError`'s template in `auth.ts` (`` `auth: ` `` → `` `auth failure: ` ``),
  confirmed 6 of 9 `errorCopy.test.ts` tests failed for the expected
  reason, reverted (`git diff` on `auth.ts` empty afterward) — same
  sabotage-and-restore method the operator used to verify the `Repo`
  contract suite. Two keys remain string-pinned rather than derived and are
  documented as a residual, lower-severity gap (`docs/error-handling.md`
  §7): `'locked out'` and `'lock: no session to protect'` are literals
  lockStore.ts hand-throws/substitutes (not from a named `Error` subclass
  this test file can construct), and `lockStore.ts` isn't an owned file
  this track can refactor to expose a reusable constant instead.

- 2026-08-19 — **`repo.local.ts`'s `getConfig()`/`updateConfig()` now
  guarantee `RepoError` on every failure path, closing a gap the final
  whole-codebase review found (`fix/repo-wrap`).** Both functions sit
  outside the `createCrudRepo` factory (`Config` is deliberately atomic,
  §10.3) and skipped the `wrapUnknown()` normalization every `CrudRepo`
  method funnels through — a mocked `db.config.get`/`put` rejection
  surfaced as a bare `Error`, not `RepoError`. Currently dormant (no UI
  consumer of `Repo` exists yet, Wave 2 hasn't started) but would have
  silently broken any `catch (e) { if (e instanceof RepoError) … }` the
  moment Track G's Settings screen called `updateConfig`. Fixed by wrapping
  both bodies in the same try/catch → `wrapUnknown(error)` shape as
  `add()`/`update()`/etc., keeping the `schemaVersion` `invalid_input` guard
  outside the try (a caller-input rejection, not a storage failure to
  normalize — same placement as `add()`'s pre-storage `validate(item)`
  call). TDD: `repo.local.test.ts` mocks `db.config.get`/`put` to reject and
  asserts `RepoError` (watched failing first against the un-fixed code).
  - **Sweep, mechanical not by inspection, per `docs/error-handling.md` §6:**
    a second, real defect of the identical shape was found this same pass —
    `createCrudRepo<T>`'s `addMany()` catch handler calls `await
findDuplicateId(table, items)` (a second storage call, `table.bulkGet`)
    to name the conflicting id, but that nested await sat outside any
    try/catch: a failure _there_ (a second, unrelated storage fault racing
    the original `ConstraintError`) would have escaped `addMany()` as a bare
    `Error` too. Fixed by wrapping that inner lookup in its own
    try/catch → `wrapUnknown(lookupError)`, mirrored by a TDD test that
    mocks `db.movimientos.bulkGet` to reject after a genuine duplicate-id
    `bulkAdd` failure.
  - **Full sweep results, by category (both findings above already listed):**
    every other exported path out of `repo.local.ts` (`ready()`,
    `migrateSchema()`'s only production call site via `performReady()`,
    every `CrudRepo` method, cursor decode/encode) already funnels through
    `wrapUnknown()` or `ready()`'s own equivalent inline wrapping — verified
    by re-reading the whole file method by method, not by trusting the
    pattern held. `migrateSchema()` itself stays unwrapped when a
    registered `Migration` throws raw — left as-is deliberately: it's
    explicitly documented as "not part of the frozen `Repo` port" (test-only
    export for unit-testing the dispatch registry in isolation), and its
    one real call site (`performReady()`, via `ready()`) already gets the
    outer wrapping, so duplicating it inside `migrateSchema()` would be
    redundant, not protective.
  - **`repo.fake.ts` parity: nothing to fix.** It has zero `try`/`catch`
    blocks anywhere in the file (grepped to confirm) — every throw is a
    deliberate, already-typed `RepoError`, because the fake is pure
    in-memory logic with no I/O boundary that can fail unexpectedly. Its
    `getConfig()`/`updateConfig()` use `structuredClone(config)` on a
    `Config` that's plain JSON-serializable data (`schema.ts`: numbers,
    strings, arrays, plain objects — no functions/non-cloneable values), so
    there's no realistic clone-failure mode either. The real repo's two
    fixed gaps were genuinely real-repo-only: they exist because Dexie/
    IndexedDB is a real I/O boundary the fake doesn't have.
  - **Contract-suite question: should `repo.contract.ts` assert an
    _unexpected_ storage failure surfaces as `RepoError`, not just known
    failure codes?** Judged untestable at the contract level without
    over-coupling it to one implementation's internals, so not added.
    `testRepoContract(makeRepo)`'s only injection point is `makeRepo(): Repo
| Promise<Repo>` — a finished `Repo` instance, with no shared seam to
    fault-inject an "unexpected storage failure" through, because the two
    implementations don't share an underlying storage engine to fault-inject
    into (Dexie/IndexedDB vs. a plain in-memory array/variable — there is no
    common thing to break). Adding one would mean either a bespoke hook per
    implementation (exactly the internals-coupling the suite's own doc
    comment says to avoid) or asserting only on the known-failure paths the
    suite already covers (duplicate id, missing id, bad input, malformed
    cursor) — which it already does, via `.rejects.toMatchObject({ code })`
    on every one of them. The gap this pass closed (an _unexpected_,
    non-deliberate failure, e.g. the underlying store rejecting) is
    necessarily implementation-specific to exercise — it needs mocking
    `db.config.get`/`table.bulkGet`/etc., which only exists on the dexie
    side — so it correctly belongs in `repo.local.test.ts`'s own file (done
    above), not the shared suite.
  - **`bun.lock`'s root `"name"` field corrected from `"moneta"` to
    `"kurobello"`** (matching `package.json`, per the frozen-storage-
    identifier rule) — silent drift `bun install` does not self-heal (a
    plain `bun install` left it untouched; confirmed empirically before
    touching anything). Hand-edited as a single-line change rather than
    regenerated: a full `rm bun.lock && bun install` was tried in a scratch
    copy first and churns ~1150 lines (transitive dependency version bumps
    unrelated to this fix), so the targeted edit was used instead, verified
    with `bun install` afterward reporting no further lockfile changes.
  - `bun run check` green (typecheck, lint, `no-raw-px.sh`, 32 test files /
    314 tests) after all of the above.
- 2026-08-19 — **Lock/auth hardening pass (`fix/lock-hardening`): two
  CRITICAL defects fixed, plus the systematic sweep for the same two bug
  shapes across the whole layer.** A final whole-codebase review found the
  previous fixer branches (including the phase-2 error-handling pass right
  above) had been applied per discovered bug, not per bug-shape: the exact
  hazard fixed in `syncLockedSession` was never swept for in its sibling
  `lockStore.init()`, and the exact race fixed in `repo.local.ts`'s
  `update()`/`remove()` was never ported to `pinLock.unlockWithPin`'s attempt
  counter. This pass fixes both instances and then sweeps `lockStore.ts`,
  `pinLock.ts`, `authStore.ts`, `auth.ts`, `src/features/lock/**`,
  `src/features/auth/**` for every other occurrence of the same two shapes.
  Findings below keep the operator's original numbers (1–6, 9, 10) as given
  in the task brief; 7 and 8 were never included in this task's brief (not
  necessarily a gap — plausibly findings the operator routed elsewhere).

  1. **CRITICAL — `lockStore.init()`'s `hasVault()` was an unguarded
     IndexedDB read.** A rejection (Safari private browsing, quota errors, a
     blocking extension) left `phase` at `'unknown'` forever — `AppLock`
     wraps the whole `RouterProvider` and renders `null` while `'unknown'`,
     with no error boundary able to catch an unhandled rejection inside a
     `useEffect`. Fixed: the whole boot-time read (including the new
     vault-level biometric-enrollment check, finding 9) is one `try`: on
     failure, degrade to `phase: 'unlocked', enabled: false` (the PIN lock is
     a convenience layer on top of Google auth, not the only guard on the
     data, specs.md §5) and `console.error` — a security-relevant swallow
     must never be silent (`docs/error-handling.md` §2). Proven by
     `lockStore.test.ts`: `hasVault()`/`isBiometricAvailable()` rejecting
     both still land on `'unlocked'` with `console.error` called; watched
     both fail first (`phase` stuck, error not yet called) before the fix.

  2. **CRITICAL — `pinLock.unlockWithPin`'s `failedAttempts` counter lost
     concurrent updates.** The catch branch wrote `vault.failedAttempts + 1`
     from a snapshot read at the top of the function — three concurrent
     wrong PINs each read the same stale `0` and each wrote `1`, so the
     5-attempt throttle (specs.md §5's entire brute-force defense for a
     4-digit PIN, alongside PBKDF2) never actually reached 5 under
     concurrent guessing, trivial from a devtools console. Fixed with the
     same `db.transaction('rw', db.vault, async () => {…})` pattern
     `repo.local.ts` already uses: read the _current_ value and increment
     inside one transaction, so concurrent transactions on the `vault` table
     serialize instead of racing. Proven by a new `pinLock.test.ts` test
     firing three concurrent wrong PINs via `Promise.allSettled` and
     asserting `failedAttempts === 3`; watched it fail at `1` first with the
     unfixed code, matching the operator's own reproduction exactly.
     Simplified two related read-then-conditionally-write sites (the
     `failedAttempts: 0` resets in `unlockWithPin`/`unlockWithBiometric`) to
     unconditional writes instead — a write that doesn't derive its new
     value from a prior read can never lose a concurrent update, so there
     was nothing to make atomic there; simpler than wrapping them in a
     transaction too.

  3. **HIGH — `lockStore.resume()` inferred success from "didn't throw."**
     `hydrate()` owns its own errors and resolves into `status: 'error'`
     (the documented `docs/error-handling.md` pattern) rather than throwing,
     so a _correct_ PIN unlocking a vault whose cached token had expired
     still got `phase: 'unlocked', error: null` — a clean-success lie
     (`docs/error-handling.md` §4). Fixed: check
     `useAuthStore.getState().status` after `hydrate()` resolves; a correct
     PIN is still honored (`phase: 'unlocked'`, no reason to re-lock) but the
     failure is now recorded as a new `SESSION_RESTORE_ERROR` instead of
     `null`. Proven by two new `lockStore.test.ts` tests (hydrate leaving
     `status: 'error'` vs `'authenticated'`) driving a `status`-aware
     `authStore` mock; watched the failure-path test fail first
     (`error` was `null`) before the fix.

  4. **HIGH — the lockout's forced re-login was invisible and separately
     undone; combined with finding 6 under one mechanism per the operator's
     explicit decision.** _Invisible:_ `resume()`'s `LockedOutError` branch
     set `phase: 'unlocked'` and `error: LOCKED_OUT_ERROR` in the same
     `set()` — `LockScreen`, the only prior consumer of `lockStore.error`,
     unmounts in that same instant (it returns `null` once `phase !==
'locked'`), so the message was structurally unreachable. _Undone:_ the
     same branch called `logout()` (→ `status: 'idle'`), and
     `RequireAuth`'s mount effect fires a silent `restore()` on `'idle'` — if
     the browser still held a live Google session (the normal case; logout
     never touches Google's), the same account got silently signed back in
     within about a second with no PIN, defeating the whole point of
     specs.md §11 (2026-06-26)'s "lockout forces a fresh Google re-login."
     Fixed with the operator's chosen mechanism: a new, non-secret,
     per-device "has a Google login ever succeeded here" marker, persisted
     in a **separate Dexie database** (`src/lib/loginMarker.ts`, db name
     `kurobello-device`) — not a table on `db.ts`'s `kurobello` (owned by
     another in-flight track this pass must not edit; a new standalone
     module was the operator's explicitly offered alternative). Set by
     `authStore.login()` on explicit success only; cleared by
     `pinLock.resetVault()` (the single choke point both the lockout branch
     and the explicit `LockSettings` "Desactivar" call already funnel
     through, so one change covers "the lockout/reset path" without
     duplicating the call at each site); `authStore.restore()` now returns
     immediately, before ever touching `status`, when the marker isn't set.
     _Invisible_ half fixed separately: `AppLock` (which stays mounted
     across the phase transition, unlike `LockScreen`) now renders a
     dismissible `role="alert"` banner whenever `phase !== 'locked' &&
error`, with a new `clearError` store action wired to its close button.
     Proven by: `authStore.test.ts` (`login()` calls `markLoggedIn()` on
     success only; `restore()` gated on `hasLoggedInBefore()`),
     `pinLock.test.ts` (`resetVault()` clears the marker), `AppLock.test.tsx`
     (the banner renders once unlocked, is absent while still `'locked'` so
     `LockScreen`'s own alert isn't duplicated, and its close button calls
     `clearError`).

  5. **MEDIUM — `LockSettings`'s "Desactivar" called `void reset()` with no
     local error handling.** `docs/error-handling.md` §7 permits a bare
     `void action()` only when the action self-catches; `reset()` doesn't —
     `resetVault()`'s `db.vault.delete` can throw under the same storage
     conditions as finding 1, and a failure there silently did nothing.
     Fixed by giving "Desactivar" the same local `onReset` try/catch
     `+ setError` shape "Activar lock"'s `onEnable` already has. Proven by a
     new `LockSettings.test.tsx` test: a rejecting `reset()` mock now renders
     an actionable Spanish alert instead of nothing; watched it fail first
     (no alert appeared) before the fix. A second new test confirms a
     successful reset leaves no stale alert behind.

  6. **MEDIUM — folded into finding 4 above** (the login-marker mechanism):
     `restore()`'s `prompt: ''` is only silent when the client already holds
     a grant; on a genuine first-ever visit it could surface real Google UI
     before the user clicked anything, contradicting specs.md §10.1's "I log
     in with Google" (an act, not something sprung on load). The same marker
     gate that fixes the lockout's forced re-login also fixes this: `restore
()` no-ops entirely on a first visit (no marker yet), so
     `WelcomeScreen` always loads first with no popup risk.

  7. **LOW — the biometric button was gated on platform capability, not
     vault enrollment.** `LockScreen` read `biometricAvailable`
     (`isBiometricAvailable()`, a device capability) instead of asking
     whether _this vault_ enrolled biometrics — a user who declined
     biometrics at enrollment still saw a button that always failed with
     "no está disponible en este dispositivo," on a device that plainly did
     support it. `pinLock.biometricEnabled()` already existed for exactly
     this and was imported nowhere. Fixed: `lockStore` gained a
     `biometricEnrolled` field (populated in `init()`'s guarded try, from
     `biometricEnabled()`, only once a vault is confirmed to exist);
     `LockScreen` now gates its button on that instead of
     `biometricAvailable` (which `LockSettings` still correctly uses at
     _enrollment_ time, when there's no vault yet to ask). Proven by two new
     `LockScreen.test.tsx` tests (`biometricEnrolled: false` with platform
     support hides the button; `true` shows it) and three new
     `lockStore.test.ts` tests covering `init()`'s three cases (no vault →
     never calls `biometricEnabled()`; vault + not enrolled; vault +
     enrolled).

  8. **LOW — `isBiometricAvailable()`'s legitimate swallow lacked the
     standard's required comment + log.** Degrading to `false` on a probe
     failure is correct (the PIN fallback always exists), it just didn't
     carry the explanatory comment and `console.warn` `docs/error-handling.md`
     §2 requires of every legitimate swallow. Fixed; proven by a new
     `pinLock.test.ts` test asserting `console.warn` fires when the
     platform API rejects.

  **The sweep (the actual deliverable — mechanical, not just the named
  instances), across `lockStore.ts`, `pinLock.ts`, `authStore.ts`,
  `auth.ts`, `src/features/lock/**`, `src/features/auth/**`:**

  - **Category 1 — unguarded async reads feeding a state transition.**
    Beyond finding 1 itself: `lockStore.onVisible()`'s
    `isBackgroundExpired()` call was the same shape — a raw IndexedDB read
    whose rejection escaped a `void onVisible()` call site in `AppLock`'s
    `visibilitychange` listener and silently skipped the re-lock `set()`.
    Fixed by catching it at the call site and **failing closed** (treat an
    unreadable background-expiry state as expired, i.e. re-lock) rather than
    finding 1's **fail-open** default (treat an unreadable vault-existence
    state as "no vault," i.e. unlocked) — the two defaults look
    contradictory but aren't: finding 1 is "can we tell if a lock should
    exist at all," where refusing to boot is strictly worse than the PIN
    lock's own stated non-goal (it's a convenience layer, not the real
    security boundary, specs.md §5); `onVisible`'s check is "should an
    _already-established_ lock re-engage," where the 5-attempt throttle is
    the real defense (specs.md §5) and an ambiguous read must not silently
    default to leaving the app open. See the `docs/error-handling.md`
    addition below. Also found and fixed: `resume()`'s `LockedOutError`
    catch branch did more unguarded async work (`resetVault()`) _inside_ the
    catch itself — if that rejected, the exception escaped `resume()`
    entirely as an unhandled rejection from `LockScreen`'s `void
unlockPin(pin)`. Wrapped in its own inner try/catch with a
    `console.error`, so the lockout still lands on a renderable, logged-out
    state even if the wipe itself fails. `auth.ts` and the remaining
    `features/auth/**` components: nothing else found — every store action
    there (`connectDrive`, `hydrate`, `login`) was already self-catching
    from the phase-2 error-handling pass, and no component reads `pinLock`/
    `db` directly.

  - **Category 2 — read-modify-write without a transaction.** Swept every
    `db.vault.update()` call site in `pinLock.ts` (4 total): the named
    `failedAttempts` increment (finding 2, fixed transactionally) and two
    more `failedAttempts: 0` resets of the identical shape, simplified to
    unconditional writes instead (see finding 2 above — no read to race
    against once the write no longer depends on one).
    `updateSession()`/`markActive()` are absolute writes with no prior read
    to lose, so "last write wins" is the correct, already-safe semantics for
    concurrent calls — not a bug. Nothing else in `lockStore.ts`/
    `authStore.ts`: their `set()` calls are synchronous zustand merges
    derived from local variables, not a second async read of persisted
    state, so there is no interleaving window to race in the first place.

  - **Category 3 — `void someAction()` call sites whose action doesn't
    self-catch.** Audited every `void` call across the owned files (10
    total, `pinLock.ts:forgetDek(): void` excluded as a return-type
    annotation, not a call). Found two: `lockStore.onHidden()`'s `void
markActive()` (fixed by making `markActive()` self-catch internally,
    `console.warn` on failure — a best-effort timestamp write, same
    reasoning as `syncLockedSession`) and `LockSettings`'s `void reset()`
    (finding 5). The rest were already safe: `LockScreen`'s `void
unlockPin`/`void unlockBiometric` call into `resume()`, which after
    findings 3+4's fixes never rejects; `AppLock`'s `void init()`/`void
onVisible()` call into functions now fully self-catching (findings 1 and
    the category-1 `onVisible` fix); `RequireAuth`'s `void restore()`,
    `WelcomeScreen`'s `void login()`, and `DrivePermissionScreen`'s `void
connectDrive()` were already self-catching from the phase-2 pass and are
    unchanged here.

  **`docs/error-handling.md` updated** (owned this pass): §2 gains a short
  note under "Where to catch, and where not to" naming the fail-open
  (finding 1) vs fail-closed (`onVisible`, category 1) distinction above as
  a documented judgment call, not an inconsistency — the question to ask is
  "does refusing to proceed here protect anything the feature actually
  promises, or does it just break boot for no security benefit," matching
  `pinLock.isBiometricAvailable()`'s existing "legitimate swallow" framing
  in kind.

  **Also closed while in the file:** `src/features/lock/errorCopy.test.ts`
  now imports `LOCKED_OUT_ERROR`/`NO_SESSION_ERROR` from `lockStore.ts`
  instead of restating them as string literals — closing the residual gap
  the phase-2 entry above flagged as "underivable without owning
  `lockStore.ts`" (this track does).

  `bun run check` green (342 tests, up from 309) throughout; `bun run build`
  verified after the `AppLock`/`lockStore` changes. Not merged/pushed per
  the operator's instruction — stays on `fix/lock-hardening` for review.

- **2026-08-19, `fix/types` — de-duplicated the `BottomSheet`/`CenterModal`
  prop types, audited the rest of `src/` and found nothing else worth
  extracting.** `BottomSheet.tsx` and `CenterModal.tsx` each declared a
  private `{labelledBy xor ariaLabel}` union and an exported `Props` type
  that repeated `open`/`onClose`/`children`/`className`/`initialFocus`/`ref`
  verbatim, including the `initialFocus` JSDoc copied between files —
  genuine duplication (two names for one shape), not a deliberate
  difference. Fixed by moving the label union and the full shell prop
  surface into `src/components/shared/useOverlay.ts` (the module that
  already owns `UseOverlayOptions`, the subset of the same fields the hook
  itself takes) as `OverlayLabelProps` and `OverlayShellProps<T>`;
  `BottomSheetProps`/`CenterModalProps` are now `OverlayShellProps<HTMLDivElement>`
  aliases, so both component's public type names are unchanged for
  consumers. Pure type-level change — no runtime behavior, no widened/narrowed
  API.

  Audited all ~59 non-test `type`/`interface` declarations under `src/` for
  the same shape of bug (identical or near-identical shapes under different
  names, or a shape restating something `schema.ts`/`repo.ts` already
  owns). Found one look-alike that is **not** duplication and was left
  alone: `repo.local.ts`'s `EntityConfig<T>` (dexie table/index wiring) and
  `repo.fake.ts`'s `CrudRepoConfig<T>` (in-memory store wiring) share 4
  field names (`dateField`, `seccionField`, `tiebreakField`, `validate`) but
  `EntityConfig` carries 5 more dexie-specific fields (`table`,
  `compoundIndex`, `fastIndex`, `fastSeccionIndex`, `entityLabel`) that
  `CrudRepoConfig` has no use for — a real per-backend difference, not an
  accidental fork; unifying them would either bloat the fake's config with
  dead fields or force the dexie repo's index wiring through an
  under-specified shared shape. Every other shared/component `Props` type
  audited (`SegmentedControlProps`, `ToggleProps`, `DateChipPickerProps`,
  `MovimientoRowProps`, `IconAvatarProps`, `TagChipProps`,
  `InfoButtonProps`, `MovimientoVisual`, `MovimientoAmountView`, and the
  auth/lock/drive store types) is single-use and colocated correctly — left
  as-is, not an oversight. `bun run check` green throughout (347 tests).

- **2026-08-19, `fix/syntax` — converted every `function` declaration under
  `src/` (excluding the shadcn-generated `src/components/ui/**`) to a const
arrow function, and turned on real enforcement so it can't drift back.**
151 declarations converted via an AST codemod (ts-morph, run once and
discarded — never added as a project dependency); one additional
`function`-expression (a named test-only equality tester in
`src/test/setup.ts`) converted by hand since it wasn't a declaration and
  so outside the codemod's scope. Two conversion-caused issues, not
  stylistic ones:
  - `repo.local.ts`'s `wrapUnknown(error): never`, called bare as the last
    statement of 9 `catch` blocks, relied on TypeScript's control-flow
    unreachability analysis for `never`-returning _function declarations_ —
    confirmed with a minimal repro that this does not extend to
    `never`-returning `const` arrows (`TS2366`, "lacks ending return
    statement"). Fixed by adding `return` at each call site — the call
    still throws unconditionally, so behavior is unchanged.
  - `authStore.ts`'s `errorMessage` and `pinLock.ts`'s `asBytes`/
    `readVault`/`decryptSession` were referenced (in file order) above
    their declaration. Traced each call site: none is an actual TDZ hazard
    — every one sits inside a closure invoked after module evaluation
    finishes (a zustand action, an exported async function), never at
    top-level synchronous module-eval time. Reordered anyway so
    declaration precedes use, matching `const`'s lack of hoisting and
    removing any doubt for future refactors.

  **Enforcement:** `func-style: ["error", "expression"]` in
  `.oxlintrc.json`, with an override exempting `src/components/ui/**`
  (shadcn CLI output). Verified both directions by reintroducing a
  `function` declaration in a normal file (lint fails) and inside
  `src/components/ui/button.tsx` (lint stays clean); both probes reverted
  before committing.

  **Modern-syntax enforcement:** enabled 76 rules from the previously-unused
  `unicorn` plugin (`.oxlintrc.json` ran 4 rules total before this pass),
  picked for genuine modernization or error-prevention value, and fixed
  every violation found rather than silencing it — `.replace(/…/g)` →
  `.replaceAll()` in both PIN input handlers; bare `items.forEach(validate)`
  / `.some(isConstraintError)` (an iterator-callback-reference footgun)
  wrapped in explicit arrows in _both_ `repo.local.ts` and `repo.fake.ts`
  (the mirrored fake/local pair `docs/error-handling.md` names — fixed in
  both, not just one); index-math (`arr[arr.length - 1]`) and
  `Array.from()` replaced with `.at()`/spread in `useOverlay.ts` and
  `repo.local.ts`; `auth.ts`'s `loadGis()` had one branch already using
  `addEventListener(..., { once: true })` and a second branch using
  `onload`/`onerror` assignment for the same script element — brought the
  second in line with the first's own established pattern. One rule fired
  a genuine false positive: `no-array-reverse` flagged
  `repo.local.ts`'s `collection.reverse()`, which is Dexie's
  `Collection#reverse()` (flips index iteration direction) sharing a name
  with, but not being, `Array#reverse()` — suppressed at that single site
  with `// oxlint-disable-next-line unicorn/no-array-reverse` and a
  comment, not disabled project-wide. Three candidate rules were enabled,
  tested, and dropped after producing only noise: `no-useless-undefined`
  (100% false-positive rate here — vitest's `mockResolvedValue` and a test
  helper's `ArrayBuffer | undefined` parameter both require an explicit
  `undefined` argument by TS arity, which isn't "useless"),
  `consistent-function-scoping` (only ever fired on test-harness
  components deliberately colocated with their test), and
  `prefer-query-selector`/`no-negated-condition` (pure style preference,
  not modernization or correctness). Deliberately never enabled: `no-null`
  (real, intentional `null` usage across 11 files), `prevent-abbreviations`
  and the naming/`filename-case` rules (would fight the Spanish domain
  terms `schema.ts` §4 freezes), `no-array-for-each`/`no-array-reduce`
  (neither method is outdated). The `promise`, `node`, and `jsdoc` plugins
  were considered and left off: `promise`'s rules would misfire against
  the two deliberate `new Promise`/`.catch()` usages already in the
  codebase (`auth.ts`'s callback-API wrapper around GIS script loading,
  and `repo.local.ts`'s synchronous promise-memoization cache in `ready()`
  — both need to stay non-`async`/`await` on purpose); `node`'s rules
  target Node built-ins this browser app barely touches; `jsdoc`'s rules
  mostly require or shape doc comments, which runs against this file's own
  "comments only when necessary" policy.

  `bun run check` green throughout (347 tests, typecheck clean, `bun run
lint` clean bar the one pre-existing `components/ui` warning). `AGENTS.md`
  updated (owned this pass) with the arrow-function rule, the
  `src/components/ui/**` exception, and the modern-syntax enforcement
  policy. `ts-morph` was added as a devDependency for the codemod and
  removed again before the first commit — it has no ongoing use once
  `func-style` is enforcing.

- 2026-08-19 — **Two error surfaces, and only two: inline or the global
  toast** (`docs/error-handling.md` §7, `specs.md` §10.6). Prompted by the
  observation that every existing error path lands on a screen that owns the
  failed action, which stops being true the moment Wave 2 writes through
  `Repo` from a sheet that closes on save. The toast is specified before the
  screens rather than inside one of them, and specified as global,
  stacking in arrival order, with an independent timer per toast — so a
  second message never truncates the first. Deliberately a notification, not
  a dialog: no blocking, no focus trap, no questions.

- 2026-08-19 — **Wave 2 decomposition, and the operating rules that go with
  it** (`docs/wave-2-plan.md`, the wave's execution source of truth). Scope:
  Wave 2 ships i18n (I), the aggregation/data layer (E1), the Toast (K), the
  Drive-consent refinements (J), the app shell (L), and the three read-only
  screens (E2 Home, E3 Search, E4 History). **Tracks F, G and H move to
  Wave 3.** Four process decisions taken because Wave 1's parallel pass lost
  time to exactly these:
  1. **The operator owns every shared doc for the duration of a wave** —
     `specs.md`, `docs/waves.md`, `ARCHITECTURE.md`, `AGENTS.md`, and any
     pre-existing directory `README.md`. Tracks write what they want recorded
     into `docs/wave-2/<track>.md`, a file each one alone owns, and the
     operator folds it in after the merge. `AGENTS.md`'s append-only rule
     stops textual conflicts between two tracks appending at the same anchor
     in a 137 KB file, not the risk of a subagent resolving one badly. A new
     `README.md` for a new directory stays the track's job — it cannot
     conflict.
  2. **The operator creates and removes worktrees, not the agents**, and owns
     the `docs/waves.md` log rows. Same reason.
  3. **The Toast ships in Wave 2 with no consumer.** With Track F deferred,
     Wave 2's screens are read-only and no failed write needs a home, so
     §12's original "it blocks the screen tracks" justification lapses for
     this wave. It is built anyway because Wave 3 is three tracks that all
     need it: a shared surface built one wave early is what lets them start
     in parallel instead of serialising behind it.
  4. **Track E is split five ways** (E1 data layer → L shell → E2/E3/E4
     screens in parallel) rather than one agent building Home + Search +
     History serially. The split is drawn along file ownership: the router
     and bottom nav belong to exactly one track (L), so the three screen
     tracks share no file at all.

- 2026-08-19 — **The chosen locale is not persisted in Wave 2, because
  nothing can choose it yet.** `docs/waves.md` Track I left "where the locale
  lives" open, leaning toward `Config.preferencias`. Resolved: Wave 2 ships no
  locale picker, so detection from `navigator.languages` is deterministic and
  reproduces the same result on every boot — there is nothing to remember.
  Persistence, the `Preferencias` field, and the picker land together in
  Track G (Wave 3), where they have a user action to persist. This keeps
  Track I out of `schema.ts` and out of the device-scoped IndexedDB store,
  which in turn keeps it out of `pinLock.ts`/`authStore.ts` — files Track J
  needs in the same wave. Deferring the persistence decision removed a
  cross-track coupling rather than postponing work.

- 2026-08-19 — **Wave 2's screens read the fake repo through one named swap
  point** (`src/lib/repoProvider.ts`, Track E1), not through scattered
  imports. Surfaced while scoping the wave: `bootstrap.ts` creates the three
  JSON files in Drive and `repo.local.ts` is a dexie-only implementation, but
  **nothing reads or writes those Drive files through the `Repo` port** — no
  Drive-backed `Repo` implementation exists at all. So the screens have no
  real data source to read, and saying so in one file with one
  `// STUB(wave3)` marker is more honest than environment-branching a choice
  that has only one option. Recorded as the largest Wave 3 candidate in §12.

- 2026-08-19 — **Wave 2 shipped: i18n, the aggregation layer, the toast, the
  Drive-consent decision, the app shell, and the Home/Search/History
  screens.** Per-track detail lives in `docs/wave-2/*.md`; the decisions that
  outlive the wave are these.

  **i18n (§10.7).** `react-i18next` + `i18next` with bundled JSON, four
  locales (`es` base and fallback, `en`, `es-AR`, `pt-BR`). Chosen over a
  hand-rolled `t()` for `fallbackLng`, `Trans` (the Welcome screen's
  inline-styled legal line), and pluralisation — a close call, argued on
  stated grounds, not reopened. Keys are compile-checked via module
  augmentation off the `es` resource, so `t('nope')` is a type error. **A
  test enforces that all four locale files carry identical key paths**: a key
  present in `es` and silently missing elsewhere degrades to Spanish mid-screen
  with no error anywhere, and five tracks added keys after the scaffolding
  landed. `errorCopy.ts` returns a **translation key**, not copy — that keeps
  it a pure, i18next-free lookup so `docs/error-handling.md` §7's drift-guard
  tests keep protecting a deterministic string→string map, and moves
  localisation to the render site. Locale detection walks
  `navigator.languages` in preference order trying exact-then-subtag **per
  candidate** (a two-pass scan let a lower-priority exact match beat a
  higher-priority subtag one), and degrades `languages` → `language` → `en`
  rather than jumping to `en`.

  **Aggregation (§10.9).** `movimientoStats.ts` is pure and is the only place
  a displayed number may come from; `dataStore.ts` holds raw entities and
  caches nothing derived; `repoProvider.ts` is the single `// STUB(wave3)`
  swap point. Money accumulates in **integer minor units**; dates are
  compared as ISO strings or parsed local-time, never `new Date(isoDate)`
  (UTC midnight, which shifts the day for every timezone this app targets).
  `series()` buckets are **clamped to their period** — unclamped, the first
  and last bucket of a month pulled in movements from the adjacent months, so
  the chart's bars did not sum to the total printed beside them.

  **Toast (§10.6, realised).** Stack capped at 3, one independent timer per
  card, identical re-raises collapse and restart their own clock.
  `toastStore` **reads no store**: `AppLock` drives a domain-free suppression
  flag, rather than the toast importing `lockStore`. That keeps the primitive
  every Wave 3 track imports from dragging pinLock/WebCrypto/Dexie behind it,
  and points the dependency policy → surface. Suppression also clears what is
  already on screen, so nothing raised (or visible) while locked can resurface
  after unlock.

  **Drive consent (§10.8) — supersedes the 2026-08-18 "in-memory,
  per-session, never persisted" entry.** The decision now persists per device
  in the `kurobello-device` IndexedDB store (`deviceStore.ts`, renamed from
  `loginMarker.ts`; the **database name is frozen**). Not `localStorage`
  (§7), not `Config` (a user who dismissed Drive has no Drive to store a
  preference in), not `db.ts` (its v1 vault table is frozen). Cleared on
  logout **and** on `pinLock.resetVault()` — a lockout-forced re-login must
  not land a different account on the previous account's answer. Because the
  screen was `connectDrive`'s only caller, persisting `'connected'` would
  have left a returning device believing it was connected with no Drive token
  and no UI to fix it; a **fire-and-forget silent re-acquire** closes that.
  It is deliberately not awaited: `lockStore.resume()` awaits `hydrate()`, so
  awaiting it made a correct PIN hang on an un-timed-out Drive round trip.

  **App shell (§10.9).** The bottom nav is persistent across `/`, `/search`
  and `/history` — the design layers it above both screen overlays — so it is
  mounted once in a pathless layout route rather than remounted per tab.
  `--bottom-nav-height` / `--bottom-nav-clearance` are layout constants in
  `src/styles/index.css`: several components must agree on the nav's height,
  which is a single-source-of-truth matter, not the per-component spacing
  `docs/ui/design-tokens.md` deliberately leaves untokenised. The safe-area
  inset adds to the bar's height rather than being eaten out of its padding.
  `LockSettings` moved to the dev-only `/kit` route: it is the only UI that
  can enable or disable the PIN vault, and rebuilding Home would otherwise
  have deleted the feature with nothing failing.

  **No notification badge dot on Home.** The design draws one; it is static
  markup bound to no signal. Rendering it tells the user something is unread
  when nothing can be. A disabled control is an honest placeholder; a fake
  status indicator is a claim the user acts on. `docs/ui/implementation-plan.md`
  was corrected to match.

- 2026-08-19 — **Two defects that a fully green suite did not catch, both
  worth remembering for their shape rather than their fix.**

  1. **`repo.fake.ts` seeded every movement one calendar day early.**
     `FAKE_REPO_SEED_DATE` was UTC midnight while `seedMovimientos` formats it
     with date-fns' local-time `format()`. Under any negative-offset timezone —
     every timezone this app targets, **including the machine this repo is
     developed on** — the seeded `fecha` was a day early and disagreed with its
     own `createdAt`. Found by Track E4, which worked around it in its own
     tests rather than editing a file it did not own, and reported it. The
     first regression test written for it **did not catch the bug**: it built
     its own repo with an explicit date, bypassing the broken constant. The
     assertion has to run against the exported singleton, because that is what
     screens import and the constant is evaluated at import time.
  2. **`detectLocale()` could blank the app.** Its default parameter read
     `navigator.languages`, which is undefined on some browsers and webviews
     where only the singular `navigator.language` is guaranteed — and it runs
     at module-import time, so the failure was a blank page rather than a
     degraded one.

  The common shape: **a value evaluated at import time, from an environment
  the test suite happens to make favourable.** Neither was reachable by any
  test that constructs its own inputs.

- 2026-08-19 — **Process: an operator brief is an argument, and the tracks
  were right to attack it.** Recorded because the corrections were worth more
  than the code in several cases. Track E1 rejected an API that returned a
  meaningless `share` for a legal call; Track E3 argued URL-encoded filter
  state was premature and gave the `replace`-vs-`push` reasoning that settled
  it; Track E2 found that Track E4's brief demanded a cross-screen comparison
  that could not exist, instead of inventing a figure to satisfy it; Track L
  stopped rather than invent a bottom nav when it could not reach the design,
  and later found a doc line still prescribing something a brief had
  overridden. Two of the wave's own defects were caused by operator
  instructions — pointing the Drive re-acquire at `syncLockedSession` (which
  sets no state) instead of `connectDrive` (which does), and specifying that
  impossible cross-screen test. Briefs should keep saying what to build and
  why; they should not be trusted as descriptions of reality.

- 2026-08-19 — **Touch targets: the hit area grows, the visible control does
  not.** A control smaller than 44px gets `min-h-11`/`min-w-11` on the
  interactive element and keeps its designed size on an inner `<span>`; the
  two are never the same element. Growing the element that also carries the
  background/border/radius resizes the _visual_ — a regression dressed as an
  accessibility fix, which is exactly what a first pass over Home shipped
  (caught in review). Square icon buttons need both `min-h-11` and
  `min-w-11`; text pills need only `min-h-11`, since they are already wide.
  Precedents to copy rather than reinvent: `DateChipPicker`'s month-nav
  buttons, `InfoButton`, `TagChip`. A comment justifying such a change must
  say what it does to the element's appearance, not just cite the 44px rule —
  a class list that reads as a strict superset of the old one is how this
  regression stayed invisible in a diff.

- 2026-08-19 — **One place maps the active locale to formatting:
  `src/lib/i18n/localeFormatting.ts`.** `useLocaleFormatting()` returns
  `{ locale, dateFnsLocale }`; no other module derives that mapping. Pure
  modules (`movimientoView.ts`, `homeView.ts`, `historyPeriodLabel.ts`, …)
  take the locale as a **parameter** and never read i18next themselves, so
  they stay independently testable — the same judgment
  `docs/error-handling.md` §7 applies to `errorCopy.ts` and `specs.md` §10.5
  applies to `DateChipPicker`'s `firstDayOfWeek`. Components read the hook
  and pass it down.

  The supported locales are **copy** locales, not formatting ones: `es` is
  neutral Spanish for Colombia/Mexico/Ecuador/Venezuela/Peru and has no
  number formatting of its own, so it resolves to the `es-CO` tag every
  amount was already formatted with. That is a deliberate trade-off, not an
  oversight — a Mexican user reading neutral Spanish gets Colombian grouping
  (see §12).

- 2026-08-19 — **Bottom-nav clearance belongs to `AppShell`'s scroll pane,
  not to each screen.** `--bottom-nav-clearance` is applied once by the
  shell; a routed screen that adds its own copy doubles the reserved space.
  Search had done exactly that and was the only screen that had.

- 2026-08-19 — **`user-event` + `vi.useFakeTimers()` do not pair reliably
  here; prefer real timers.** Both documented pairings
  (`userEvent.setup({ delay: null })` and
  `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`) hung for the
  full test timeout and leaked fake-timer state into every later test in the
  file. A debounce race is testable on real timers: `await user.type(...)`
  plus `waitFor` to settle, then a second `user.type` with **no `await` gap**
  before the assertion — nothing yields in between, so the race is
  deterministic. This is why the `fireEvent` ban (2026-06-25) did not need an
  exception carved out of it.

- 2026-08-19 — **A locale parameter has no default.** `formatMonto`,
  `getMovimientoAmountView`, `MovimientoRow`'s `locale`/`dateFnsLocale`,
  `DateChipPicker`'s two locale props, and the pure label helpers in
  `homeView.ts` / `historyPeriodLabel.ts` / `historyPeriodOptions.ts` all
  **require** the caller to pass the active locale. The earlier `es-CO`/`es`
  defaults were correct for the additive change that introduced them, and
  then let every real screen keep calling the old way while the code looked
  wired — the bug this closed. A forgotten call site is now a `tsc` error.
  This matters more than usual here because **the seed data is Colombian
  regardless of locale**, so a missed wire-up doesn't look broken; it looks
  like the data happens to be in pesos.

- 2026-08-19 — **Phrase-level date formatting uses `Intl.DateTimeFormat`,
  not a date-fns pattern.** A pattern like `"d 'de' MMMM"` bakes the Spanish
  connector `de` in as a **literal**, which no `Locale` object translates —
  under `enUS` it renders `"10 de August"`. Day/month ordering and connector
  words are locale data, not something one pattern string can parametrize.
  date-fns stays correct for patterns with no embedded words (`'MMMM yyyy'`,
  `'EEEEE'`, `'PPPP'`), which is why `DateChipPicker` and `MovimientoRow`
  each take **both** a BCP-47 `locale` and a `dateFnsLocale`.

  The shape worth remembering: **an inventory built by grepping imports
  cannot find a translated literal embedded inside a format string.** This
  bug sat in a file the sweep had already listed, and was found only by
  writing the locale-switch test. When a sweep is scoped by import search,
  say so and check the pattern strings by hand.

- 2026-08-19 — **Leaf render components call `useLocaleFormatting()`
  themselves** rather than receiving locale through props from a parent
  hook. They already call `useTranslation()` for copy; adding locale fields
  to `useHomeDashboard`'s return contract would duplicate what the hook
  gives any component for free — the single-source-of-truth rule pointing
  the opposite way from prop-threading here.

- 2026-08-19 — **One table owns tint → token, in every shape a consumer
  needs.** `src/components/shared/tintClasses.ts` maps each
  `IconAvatarTint` to an `icon` / `badge` / `pill` class string.
  Tailwind's static scanner needs each class name as a **literal**, so the
  shapes cannot be concatenated from a shared fragment at runtime — but that
  forces three _shapes_, not three _files_. Before this, `IconAvatar` and
  `TagChip` each asserted `amber = chart-3` independently, and a review
  proved the risk was real: mis-mapping one tint in a single shared table
  fails a test immediately, while the same edit to one of two parallel tables
  passed the whole suite with a category rendering one color as a row avatar
  and another as a chip.

- 2026-08-19 — **Copy language and formatting region are two independent
  axes.** `detectLocale()` resolves which language the UI speaks;
  `detectRegion()` resolves how numbers and money are formatted and which
  currency a first run seeds. `localeFormatting.ts` combines them into the
  `Intl` tag. Verified against the real runtime rather than assumed:
  `en-CO`/`en-MX`/`en-AR`/`en-BR` all resolve to plain `en` in CLDR, so for
  English copy the region axis correctly affects the _currency_ and leaves
  grouping alone; it has observable formatting effect for `es`/`pt-BR` copy
  on a non-default region, which is the point of the feature.

- 2026-08-19 — **The sign belongs to the number, not to the currency.**
  `$ -12.000,00`, never `-$ 12.000,00`. Built by reordering
  `Intl.NumberFormat.formatToParts` output — the currency symbol's position
  is locale data (leading in es-CO/pt-BR, trailing in de-DE), so prepending a
  `+`/`-` character to a formatted string is wrong by construction. Any call
  site needing an explicit sign uses `formatMontoWithSign`; hand-concatenation
  is the bug, and it was independently reproduced in two places
  (`getMovimientoAmountView` and `BreakdownCard`) before being closed.
  The reorder anchors on the first part that renders the number — `integer`,
  `nan` **or** `infinity`; anchoring on `integer` alone put the sign back
  before the symbol for a non-finite total, which a review caught.

- 2026-08-19 — **Currency always renders as a symbol**
  (`currencyDisplay: 'narrowSymbol'`), never the ISO code. Standard `Intl`
  switches to the code when the currency is foreign to the formatting region
  — that disambiguation is deliberately traded for a consistent look (user
  decision). `$` therefore means COP, MXN, ARS or USD depending on context;
  a future multi-currency view needs its own disambiguation, not the ISO
  code bolted back on globally.

- 2026-08-19 — **Offline permissions are reduced, not absent: read anything,
  create movements, for 7 hours.** No editing, deleting or settings changes
  while offline, and the window starts at the last successful online
  validation. The reasoning, so it survives being re-litigated: **appends
  commute, mutations don't.** Two devices creating movements offline merge
  cleanly because every `id` is a `crypto.randomUUID()`; two devices editing
  or deleting the same movement is a real conflict with no correct automatic
  answer. Past the window, writes stop and **reads do not** — refusing to
  show users their own local data protects nobody. User decision; spec in
  §10.11.

- 2026-08-19 — **Local data is scoped by profile, one dexie database each,
  and signing in never replaces anything.** A guest and a Google account on
  the same device get separate databases; the existing `kurobello` database
  is adopted as the first profile rather than migrated (its identifier is
  frozen by `AGENTS.md`). Rejected: a `profileId` column on every row —
  per-database isolation costs nothing at query time and makes cross-profile
  reads impossible instead of merely discouraged. Consolidating a local
  profile into an account is an **explicit user action**, implemented as a
  union by `id` (safe because ids are UUIDs), never a side effect of signing
  in. This is why `crypto.randomUUID()` (2026-06-25) turned out to matter far
  beyond ID generation. User + operator decision; spec in §10.15.

- 2026-08-19 — **No backup file and no import; data safety is Google, not a
  file.** Data lives locally on the device, and a user who wants it kept links
  their Google account. Manual backup-and-restore has poor real-world use and
  import is the expensive half (schema versions, existing-data conflicts,
  tampered files) for a flow almost nobody walks. What ships instead is a
  **CSV export for reading the data elsewhere** — a spreadsheet, an
  accountant — which is the use that actually recurs. Its purpose is
  portability, not recovery. Recorded so a later agent does not "finish" the
  missing import half: it is absent by decision. Spec in §10.12.

- 2026-08-19 — **Wave 3 stage 1 shipped: tracks S, U, V and W** (specs in
  §10.12, §10.14, §10.15, §10.16). The decisions each one closed:

  - **CSV export writes the schema field names as its header row**, not
    localized labels — they are the real Drive column contract, stable across
    locales, and a file re-opened anywhere keeps meaning the same thing.
    `extra` is deliberately **excluded**: it is the escape hatch for fields
    not yet promoted to a column, its shape is not uniform across rows, and
    it is where anything sensitive smuggled onto a `Movimiento` would land.
    Numbers go out with `useGrouping: false` and `maximumFractionDigits: 20`
    — a data export must preserve the exact stored `monto`, so the locale
    decides only _which mark_ is the decimal separator, never how much
    precision survives (Intl's default of 3 would silently round).
  - **The export pages through the `Repo` port by cursor** rather than one
    unbounded `list()`. Both current implementations answer a limit-less
    `list()` with the whole table, but `repo.ts` promises no such thing, and
    a Drive-backed implementation is the likeliest to cap a response. A page
    that comes back **empty ends the export regardless of `nextCursor`** —
    the port documents no "last page's cursor is undefined" invariant, so
    trusting the cursor alone would spin forever against a future repo.
  - **A blob-URL revoke is deferred past the click task.** Revoking in the
    same task as `anchor.click()` races the browser's blob read; iOS Safari
    is a stated target for this feature and is exactly where an early revoke
    cancels the download.
  - **`AmountField` is a controlled string, not a controlled number**, and
    is never `<input type="number">` (native spinners, and `valueAsNumber`
    ignores the locale's decimal mark entirely). Parsing lives in one pure
    module built on `Intl.NumberFormat().formatToParts`, and it **gates on a
    strict decimal pattern before `Number()`**: bare `Number()` turns an
    empty normalization into `0` and accepts hex literals, so a lone
    separator once parsed as $0 and `0x1a` as 26. Money math is on
    `AGENTS.md`'s TDD list for exactly this class of bug.
  - **`ConfirmDialog` ships without a `pending` or `confirmVariant` prop.**
    Both known Wave 4 callers are deletes, and nothing calls it yet — a prop
    added before a caller exists is the "defaulted parameter nobody passed"
    shape Wave 2's review named as its most expensive finding. Wave 4's
    first real caller shapes them.
  - **Local data is scoped as one dexie database per profile**, with the
    frozen `kurobello` database **adopted** as the first profile and every
    additional one named `kurobello-<profileId>` — a suffix, never a rename.
    The registry is its own device-scoped database (`kurobello-profiles`).
    The **active profile is resolved by recency**, not by a persisted
    "active" flag: nothing today needs the two to differ, and Wave 5+'s
    switcher can add the distinction when something does.
  - **`repoProvider.getRepo()` still returns the fake repo, deliberately.**
    The real per-profile binding is built and proven to isolate a guest from
    a signed-in account, but flipping it before Wave 4's create UI exists
    would leave a technically-correct, unusable, empty app.
  - **The service worker registers with `registerType: 'prompt'`.** A deploy
    no longer takes over an open tab silently — the classic way a lazily
    loaded chunk 404s against a stale manifest. A failed periodic update
    check is logged and never toasted (offline is not an error), but it is
    **not** swallowed empty: a background poll has no second, user-visible
    path the way `authStore.restore()`'s silent re-auth has an explicit
    `login()` behind it, so a persistently broken check would otherwise
    surface to nobody. `pagehide`, not `beforeunload`, cleans up the poll —
    `beforeunload` is unreliable on mobile Safari and disqualifies the page
    from bfcache.

- 2026-08-19 — **A test that only fails under parallel-agent load is a real
  fragility, not an environment quirk.** Three Wave 3 tracks independently
  reported `src/router.kitError.test.tsx` timing out at vitest's default 5s
  while sibling worktrees ran their own suites; it passes in ~1.9s in
  isolation. The test does a dynamic `import('@/router')`, so the budget was
  bounding transform time under CPU contention, not a race — the assertion
  was already event-based. Raising it does not weaken what the test proves.
  Recorded because parallel worktrees are this project's normal workflow, so
  "it only fails when agents run in parallel" describes the common case, not
  an edge one.

- 2026-08-19 — **A stage's file-ownership table must be checked for the
  _unowned_ file two tracks will both want.** Wave 3 stage 1 assigned every
  file a track would edit, and left `deviceStore.ts` assigned to nobody.
  Track V needed a device-scoped registry and Track R needed a device-scoped
  timestamp; both correctly refused to edit a file they did not own, and both
  built their own Dexie database instead. The result was three device
  databases where one would do — a defect produced by the **plan**, not by
  either track's judgment, and invisible to both per-track reviewers by
  construction. The cross-track pass found and fixed it. The cheap rule that
  prevents it: when drafting an ownership table, explicitly ask which
  unassigned file two or more tracks in the same stage will each want **for
  different reasons**, and assign it (or split it) at planning time. This is
  the second time the same shape appeared in one wave, so it is a process
  finding, not an incident.

- 2026-08-19 — **Rejected: a discriminated union on `AuthState` to separate
  identity from Drive-token capability.** `status === 'authenticated'` with
  `session: null` is a real state (§10.11, offline entry). Track R's review
  swept every reader of `session`/`user` and found three, all already
  null-safe — so this is safe today by evidence, not by convention. A union
  would touch ~15 `set()` call sites for no real narrowing gain, since a
  zustand selector reading `session` and one reading `status` do not narrow
  together anyway. The compiler already cannot be fooled without a visible
  `!`/`as`. The real risk is a future engineer _assuming_ authenticated
  implies a token, so the answer is a named selector
  (`selectDriveSession`) whose name carries the warning a bare
  `state.session` read does not — additive, no migration, added when Track T
  first needs it rather than speculatively now.

- 2026-08-19 — **The no-backend constraint was re-evaluated with real numbers
  and reaffirmed.** User asked, directly, how viable and how expensive a
  backend would be. The answer that came back: **money is not the obstacle.**
  A `Movimiento` in Postgres is ~250 bytes all-in, so Supabase's 500 MB free
  tier holds ~1.4 M movements ≈ 250–600 users; Cloudflare D1's 5 GB holds
  thousands; past free it is $5–25/month. What actually costs:
  - **The product's thesis.** §2 says privacy comes from the architecture,
    not from a promise. "Your money data is in your Drive, on nobody's
    server" is _verifiable_; with a backend it becomes "trust me", which is
    what every competitor already says.
  - **Becoming a data controller** for financial data (Colombia Ley 1581,
    Brazil LGPD, Argentina 25.326): purpose, deletion, breach notification.
    These obligations do not scale down — five users carry the same duties as
    five thousand.
  - **Operational duties forever**, and a one-way door: Drive → backend is
    easy, backend → Drive needs user consent and coordination.
  - Also recorded because it was the load-bearing correction: **a backend
    does not remove the sync problem.** Offline-first still needs the local
    write, the outbox, the flush triggers and the reconciliation. A backend
    removes exactly one sub-problem — whole-file lost updates — which is
    ~a quarter of the work, and which §10.19's per-device files remove for
    free.
  - Free tiers also mislead in a specific way: **Supabase pauses a free
    project after a week of inactivity**, which for a personal-finance app
    used by a handful of people means a dead app, and that never shows up in
    a "how many users fit" answer.
  - **Revisit only when a feature §6 already names needs it** — scheduled
    reminders, anything cross-user, or hiding a third-party API key — and
    then build the smallest thing that works: a **stateless function that
    stores no user data**, which keeps the privacy claim essentially intact.

- 2026-08-19 — **Drive layout: per-device append-only operation logs, sharded
  by month.** Full spec in §10.19. The decisions inside it, so they are not
  re-litigated piecemeal: files hold **operations, not state**, so one merge
  rule (last write per `id` wins) covers create/edit/delete/multi-device;
  **exactly one device writes any given file**, which makes the lost update
  structurally impossible rather than merely handled; a `put` carries the
  **whole record, not a diff**, so an op is self-sufficient in a file whose
  period it does not belong to; a **closed shard is frozen forever**, which is
  what makes multi-year history cacheable; and there is deliberately **no
  manifest file**, because it would be the one multi-writer file and the
  folder listing already carries the same information.

- 2026-08-19 — **Ordering uses a hybrid logical clock, not the device clock.**
  UTC was never the issue (`Date.now()` is already UTC); accuracy is. A time
  server does not help because the case that matters is offline. Wall-clock
  ordering lets two devices compute _different_ merge results — a logical
  clock cannot. Drive's server `Date` header is the cheap sanity bound
  against a device claiming to be in 2099. `Movimiento.fecha`/`createdAt`
  keep using the device clock deliberately: they mean "when it happened to
  the user", where skew is irrelevant.

- 2026-08-19 — **Deleting is allowed offline; editing is not (yet).**
  Supersedes half of §10.11's restriction. That rule existed because
  "mutations produce a conflict with no correct automatic answer" — with an
  operation log there _is_ an automatic answer, and for a delete it is
  unambiguous because a delete is terminal. Editing stays online-only for
  now: record-level last-write-wins can still silently drop one of two
  concurrent field edits, and field-level merging is not worth building yet.

- 2026-08-19 — **On a concurrent delete-vs-edit, the movement revives, and
  the app briefly explains why.** User decision. Losing data silently is worse
  than a row the user can delete again; the log already holds both versions,
  so reviving costs nothing. The explanation is what separates it from a
  mysterious resurrection. Corollary recorded in §10.19: nothing is discarded
  at merge time, so a future "which version did you mean?" screen needs no
  new storage and no format change — only `basedOn`, which ships now.

- 2026-08-19 — **Editing data older than six months stays allowed.** The only
  argument for a cutoff was making our own sync simpler, and §10.19 handles an
  old edit correctly without one — so a wall there would be pushing our cost
  onto the user. This is personal finance (§1), not bookkeeping: there is no
  closed accounting period to protect, and people genuinely reconcile late.
  Make it deliberate rather than casual (not the default gesture on an old
  row); do not prohibit it.

- 2026-08-19 — **The write path's convention, settled once (§10.13, Track T).**
  Every mutation goes through one `runMutation()`: consult
  `networkStore.canWrite()` **exactly once** — the single place the offline
  policy is enforced — then apply optimistically, then write to the repo,
  then enqueue the operation. Decisions inside it:
  - **Optimistic with rollback**, not pessimistic. Chosen for the repo this
    app is _going_ to have — a Drive-backed one, where a round trip is
    visible — rather than for today's fast local one, so the convention does
    not have to be revisited when the slow implementation arrives.
  - **The optimistic apply and the rollback both use zustand's updater
    form**, so two mutations racing cannot clobber each other's state. The
    rollback is an inverse transform, not a captured snapshot, for the same
    reason. (A delete's rollback re-appends rather than restoring the array
    index; that is deliberate and safe — every screen sorts explicitly
    through `movimientoStats`, so raw store order is not observable, and
    restoring a captured index would be wrong if another mutation shifted the
    array meanwhile.)
  - **The repo write and the outbox enqueue are separate failure domains.**
    A repo failure rolls back and raises a Toast; an enqueue failure does
    **not** roll back a write that already succeeded, but raises its own
    Toast. This matters more than it looks: an operation that never queues
    never reaches Drive, ever, and the first implementation resolved
    identically on success and failure — a success-shaped value for a
    failure, on the one thing this app promises. `enqueueOperation()` returns
    a boolean for exactly that reason.
  - **Errors surface as a Toast, never inline**, because this is a store and
    not a form (`docs/error-handling.md` §7), and **no success Toast** — no
    caller needs one yet, and inventing copy for it now is the "defaulted
    parameter nobody passed" shape.
  - **The 7-hour offline window gates `delete` as well as `create`.** The
    window is about _session staleness_ — how long since we last validated —
    which applies to any offline mutation, not about merge safety. The
    "deletes commute" reasoning (§11, same date) is what makes deleting
    offline allowed **at all**; it does not exempt it from the window.

- 2026-08-19 — **The outbox lives on the per-profile database, not its own.**
  It was first built as a sixth Dexie database, hours after a cross-track
  review consolidated three into one, and for the same reason: the
  ownership table left `db.ts` unassigned again. Pending operations are
  per-profile data — they belong beside `movimientos`/`config`, so they land
  correctly for free the day `dataStore` writes through the active profile.
  Recorded because the _planning_ mistake repeated within one wave even after
  the rule was written into `AGENTS.md`, which says the rule alone is not
  enough: the ownership table has to be checked against it, not just carry it.

- 2026-08-19 — **Sync state is a watermark on the profile, never an
  `isSynced` flag.** User asked how the app would know a profile is synced,
  since signing in with Google does not imply Drive access (§5 is incremental
  authorization). A boolean lies the moment it is written — synced _when_,
  still true _now_, what about a half-finished push — so the stored value is
  the **last successful push and pull**, and everything else is derived from
  it: linked-or-not, ever-synced, up-to-date, pending. It lives on
  `ProfileRecord`, not on the device, because "my data lives in Drive" is a
  property of a profile and one device can hold a never-synced guest profile
  beside a synced Google one. Written only by the sync engine (Track Z);
  Track AA's account key answers the neighbouring question, "whose profile is
  this". Follows `AGENTS.md`'s single-source-of-truth rule directly. Spec in
  §10.19.

- 2026-08-19 — **A profile's first run gets a dedicated download view.** User
  decision. On a new device the pull is not an optimization, it is the only
  source of data, and rendering the dashboard while it runs shows `$0` and "no
  movements" — a false statement about someone's money that reads as "the app
  lost it". Gated on the absence of a successful-pull watermark, so it is once
  per profile and not a per-launch gate. Real progress rather than an
  indefinite spinner, an explicit failure state with retry, and **never a
  dashboard of zeros**. It must never block a profile that already has local
  data (§10.11). Spec in §10.19.

- 2026-08-19 — **Signing out invalidates the vault through the existing
  `pinLock.resetVault()`** (fire-and-forget, self-catching, called from
  `authStore.logout()`) rather than adding a second vault-clearing path. Its
  existing side effects are correct here too: clearing the device login marker
  is what stops `restore()`'s silent re-auth from signing the just-left
  account back in on the next cold boot — the same resurrection defect through
  a different door. `lockStore`'s same-tab-logout subscription changed from
  re-locking to resetting to `{ phase: 'unlocked', enabled: false }`, because
  re-locking behind a vault that is being deleted can only strand the tab on a
  PIN screen that will never succeed. Spec in §10.20.

- 2026-08-19 — **A profile is keyed on the Google `sub`, not the email.** The
  first implementation used `user.email`; the review caught it before anything
  shipped. `sub` is OIDC's stable, never-reassigned subject identifier and the
  `oauth2/v3/userinfo` endpoint already returns it — `auth.ts` simply did not
  map it. An email is not stable: a Workspace admin renaming a primary address
  would resolve the same person to a brand-new empty profile, which reads as
  total data loss. `accountKey` is **stored**, so this was a one-line choice
  today and a data migration in a month. `resolveGoogleProfile()` is called
  from `login()`/`restore()`/`hydrate()` and does the find-or-create inside
  **one** transaction — the review reproduced a same-tick race first, where a
  login racing a silent restore minted two profiles for one account. That is
  the same read-modify-write twin the registry had already fixed once for
  `lastUsedAt`. `getActiveProfile()`'s pure-recency resolution is unchanged:
  touching the right profile's `lastUsedAt` is enough to make recency
  identity-correct.

- 2026-08-19 — **The sign-out confirm counts distinct movement ids, not
  outbox entries**, so two queued edits to one movement read as "1" — matching
  what the copy literally claims. The "delete stored data" stub is a
  **disabled real `Button`**, not an inert `<div>`: the `<div>` pattern is for
  read-only _values_, and a disabled control is the right way to say "this
  action exists and is not available yet".

- 2026-08-19 — **Untrusted-input hardening: validate the shape, not the
  characters.** User asked for regex controls against injected content in what
  comes back from Drive. Audited before answering, and the conclusion is a
  split:
  - **A character blocklist on free text is the wrong tool and would hurt.**
    `nota`, `categoria` and `seccion` are Spanish and Portuguese — accents, ñ
    and emoji are _legitimate user data_. A blocklist rejects their own valid
    input and requires enumerating everything bad; a schema validator
    enumerates the finite good.
  - **Allowlist patterns on structured fields are right, and are already this
    codebase's convention:** `fecha` ISO, `moneda` one of six, `tipo` one of
    two, `id` a UUID. `repo.local.ts`'s `ISO_DATE_RE`/`validateMovimiento`
    already do exactly this, so the Drive reader extends an existing pattern
    rather than inventing one.
  - **XSS through rendering is structurally closed and must stay that way.**
    Zero `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function`
    anywhere in `src` (verified by grep). React escapes by default and there is
    no escape hatch. This is a property to _keep_ — a lint rule, not data
    validation.
  - **The genuinely open hazards, in value order:** number type and range
    (`monto` must be finite and positive — `1e999` parses to `Infinity`, and a
    `"5"` string poisons every sum silently); **prototype pollution**, because
    `repo.local.ts`/`repo.fake.ts` merge with `{...existing, ...patch}` and a
    `__proto__`/`constructor` key from parsed Drive JSON is live the day that
    path exists; and an unbounded file size, which is a self-inflicted DoS.
    CSV formula injection was the one real character-level threat and Track S
    already closed it.

- 2026-08-19 — **Rejected: client-side encryption of the Drive files.** It
  sounds like more protection and costs the product its own promise: the user
  could no longer open their own JSON in their own Drive, which is precisely
  what makes "your data is yours" verifiable rather than asserted. With no
  backend (§6) there is nowhere to escrow a key, so a lost key is
  unrecoverable data loss. The model deliberately trades "Google can
  technically read it" for "you own it and can read it". **What outbound
  protection actually looks like here is architectural and already true: we
  send to nobody but the user's own Drive, over HTTPS, with their own token —
  no analytics, no telemetry, no CDN (`AGENTS.md`).** The two cheap additions
  worth making are a **test** proving no file we write ever contains the
  token, PIN or vault material (§10.12 already requires it for the CSV), and a
  size cap.

- 2026-08-19 — **The Drive folder ships a plain-language `LEEME.txt` and a
  flat CSV per closed year.** User decision, on the question "if the app
  disappears tomorrow, can the user turn these JSONs into a spreadsheet?" The
  honest answer was _yes, but not by double-clicking_: §10.19's files are an
  operation log, so a naive conversion duplicates every corrected movement and
  resurrects deleted ones. That is the cost of choosing operations over state,
  and it is paid back by two additive, cheap things rather than by changing the
  format:
  - a `LEEME.txt` **written for someone who is not technical**, localized,
    telling them the `.csv` files are the easy path, that the `.json` is the
    complete record, and — in one sentence a person can hand to an assistant —
    the rule to flatten it (keep the last entry per `id`, drop the `del`s);
  - the yearly compaction also emitting a flat CSV **through Track S's
    existing module**, so the BOM/`sep=;`/decimal/injection work is not
    reimplemented. It is derived and disposable: the JSON stays authoritative
    and the app never reads the CSV back, or it would become a second source
    of truth.

  Recorded because "the data is the user's" is the claim the entire no-backend
  architecture exists to support, and a claim that only holds for someone
  technical is a weaker claim than the one being made. **The bigger hole this
  does not close: a user who never linked Drive has nothing there at all —
  portability is decided by whether the file exists, not by its format.**

- 2026-08-19 — **Rule, not a patch: no screen may render its first-run state
  to a returning user.** User noticed the third instance of one defect class,
  so it is recorded as the class rather than the case. The three found so far:
  a guest who signs in lands in an empty account (§12); a new device renders a
  dashboard of zeros while the first pull runs (§10.19); and a returning user
  whose silent re-auth lapses gets the welcome-to-the-app pitch (§10.21). All
  three are **normal states rendering as "you lost everything"** — the worst
  thing a finance app can imply, and each was reached by a different path,
  which is why fixing them one at a time kept missing the pattern.

  The general rule: **any screen reachable by both a first-time and a
  returning user must branch on the returning signal**, and any reassurance it
  shows must be verifiable against what is actually stored rather than
  inferred from a session having once existed. `AGENTS.md` § "How every agent
  works" already asks for the process finding over the instance; this is one.

- 2026-08-19 — **A movement references its category by id, not by name
  (§10.22).** Audited state before the decision: `Movimiento.categoria` held a
  display _name_, `Movimiento.seccion` held an _id_ contradicting its own
  `schema.ts` comment, and the two fixtures disagreed with each other
  (`repo.fake.ts` seeded `'Comida'`, `repo.contract.ts` seeded
  `'cat_sueldo'`) — invisible because the contract suite never renders. Two
  shipped consequences: the exported CSV carries a raw `sec_personal` column
  next to a readable `categoria` one, and `breakdownBy(…, 'seccion', …)` would
  render an id as a visible label the day Track H calls it. Chosen so a rename
  is a one-field `Config` write instead of re-emitting an operation per
  movement and re-uploading years of §10.19 shards to change one word. Timed
  deliberately: `repoProvider.getRepo()` still returns the fake repo, so there
  is no real user data and the change costs a render-site sweep rather than a
  migration on someone's money.

- 2026-08-19 — **Category icon and color become optional fields on
  `Categoria`, not an `extra` bag (§10.22).** `AGENTS.md` routes additive
  fields through `extra` first, but `Categoria` has no `extra` field — adding
  one is itself additive and strictly worse, since icon and color are
  permanent first-class attributes rather than a migration escape hatch.
  Additive and optional, so **no `SCHEMA_VERSION` bump** per `schema.ts`'s own
  rule. This deletes `movimientoView.ts`'s `CATEGORY_ICON`/`CATEGORY_TINT` —
  a hardcoded table keyed by **Spanish category names** in an app already
  shipping `en` and `pt-BR`, and the structural reason a user-created category
  could never have a color at all.

- 2026-08-19 — **Icon/color suggestion inverts the translation problem: the
  concept table speaks every language (§10.22 Decision 7).** Translating the
  user's typed category name to match it would need a translation API — a
  third party over the network — breaking §6, the offline-first guarantee, the
  no-CDN rule, and the promise that the user's own data never leaves their
  Drive. An on-device LLM is rejected for the reason §11 (2026-08-18) already
  rejected it for receipt scanning: desktop-only, missing the mobile target.
  Instead each concept carries **one multilingual keyword bag**, so "gimnasio"
  / "gym" / "academia" all resolve without knowing which language was typed.
  Offline, deterministic, testable, and it reuses `searchMatch.ts`'s
  normalizer rather than growing a second one.

- 2026-08-19 — **Suggested category color stays semantic even when it
  collides (user decision).** The operator raised the cost — nine tint
  families against a real user's more-than-nine categories means several
  categories share a color from roughly the tenth onward, weakening exactly
  the scan-by-color affordance the tint exists for — and the user reaffirmed
  the choice: "Comida is amber, Salud is green" reading correct is worth more
  than guaranteed distinguishability. Recorded so it is not re-litigated. The
  least-used-tint rule survives only for the no-match case, where there is no
  semantics to respect, which also guarantees a new category is never
  colorless.

- 2026-08-19 — **The create-category modal asks for a section, diverging from
  the design canvas (user decision).** The canvas's Custom tag modal has only
  name/icon/color, but `Categoria.seccionId` is required — so the canvas
  version can only work by silently filing every new category under the
  lowest-`orden` section. Filing a work expense under "Personal" without
  saying so is a false statement about someone's money, so the code is
  authoritative here and the canvas catches up. The control is hidden when
  only one section exists, keeping the simple case as simple as the canvas
  drew it. Resolved under `AGENTS.md`'s canvas-vs-code rule by asking, not by
  assuming.

- 2026-08-19 — **Track G1, stage 1: the taxonomy-reference migration
  (§10.22 Decision 1) implemented.** `Movimiento.categoria` now stores
  `Categoria.id`; `getMovimientoVisual` in `movimientoView.ts` is a pure
  resolution (`icono`/`color` → tipo-based fallback), and a new
  `resolveCategoria(id, config)` is the one place an id is turned back into
  a `Categoria`. `CATEGORY_ICON`/`CATEGORY_TINT` are deleted; their pairings
  moved onto `CONFIG_SEMILLA.categorias` and `repo.fake.ts`'s demo
  categories as explicit `icono`/`color`. `Categoria` gained `icono?:
CategoryIconKey` (new `src/features/tags/categoryIcons.ts`, a curated
  34-icon `lucide-react` allowlist), `color?: IconAvatarTint`, and
  `archivado?: boolean` — additive, no `SCHEMA_VERSION` bump. `schema.ts`'s
  `categoria`/`seccion` comments corrected to say "id", not "valor de la
  taxonomía". `repo.fake.ts`'s `MOVIMIENTO_TEMPLATES` switched from category
  _names_ to ids, making it consistent with `repo.contract.ts` (which
  already seeded an id) instead of the two fixtures disagreeing.
  - **The Blast radius list in §10.22 was incomplete — the sweep found
    four more real render/consumer sites**, all fixed in the same change:
    `src/features/history/HistoryScreen.tsx` (threads `Config.categorias`
    into `BreakdownCard`/`MovimientoRow`, which the listed files alone
    can't do without a caller supplying it), `src/features/home/RecentMovimientos.tsx`
    - `src/features/home/useHomeDashboard.ts` + `src/routes/Home.tsx` (Home's
      own `MovimientoRow` list — the dashboard a real user actually lands on —
      had no `categorias` source at all), and `src/lib/export/index.ts` (the
      actual `exportMovimientosToCsv` caller of `csv.ts`, which needed to fetch
      `repo.getConfig()` and pass `secciones`/`categorias` through — `csv.ts`
      alone can't resolve anything without them). None of these are owned by
      Track Z or another wave-4 track; all are one-hop callers of the files
      §10.22 already listed as owned, not scope creep.
  - **Two existing tests were quietly enshrining the exact bug this
    migration exists to fix**, found by the sweep, not by inspection:
    `HistoryScreen.test.tsx`'s breakdown test asserted `topIngreso.key` (a
    raw category id) rendered as visible text; `SearchScreen.tsx`'s active
    tag chip rendered `label: tag` (the raw id) directly. Both fixed to
    assert the resolved _name_ and that the raw id is absent from the DOM.
  - **`SearchScreen.tsx`'s free-text search matched `m.categoria` (now an
    id) directly** — coincidentally still "worked" for seed data only
    because seed ids are name-derived (`cat_sueldo` contains "sueldo"); any
    user-created category (`crypto.randomUUID()`) would have silently
    stopped being findable by name. Fixed to resolve the category's `nombre`
    before matching. Its tag filter (`selectedTags`/`toggleTag`,
    `useSearchFilters.ts`) already compared by identity and needed no logic
    change, only a rename from "name" to "id" in a doc comment — it was
    already correct by construction, just previously fed names instead of
    ids.
  - **`[seccion+fecha]` Dexie indexes verified, not assumed, to keep
    working**: `db.ts`'s only indexed movement fields are `fecha` and
    `seccion` (already an id before this change per the original audit);
    `categoria` was never indexed. No `db.ts` change, no index rebuild.
  - **`csv.ts`'s injection-escaping test was testing the wrong field**: it
    put `=HYPERLINK(...)` directly in `movimiento.categoria`, which is now
    an id, not free text. The real remaining risk is a category's `nombre`
    (still free text, still user-editable) — the test now constructs that
    shape and confirms the resolved name is still escaped the same way.
  - **`bun run check` is green** (956 tests, typecheck and lint clean)
    before any picker UI exists, per the plan's explicit ordering.

- 2026-08-20 — **Track G1, stage 2: `dataStore.upsertCategoria`/
  `archiveCategoria`/`deleteCategoria` implemented, TDD.** Built on the
  existing `runMutation` convention (§10.13): `settings`-kind mutation
  (refused offline, same as `updateConfig`), optimistic apply, rollback on
  failure, a config `put` enqueued on success. `archiveCategoria` refuses
  (toast, never the repo) when archiving would leave zero non-archived
  categories; `deleteCategoria` refuses when any loaded `Movimiento`
  references the id — both per Decision 5's semantics, Track G2's UI to
  build on top of.
  - **The same-tick race (§10.22's first edge case) is closed by a shared
    `upsertById` helper**, not by discipline at each call site: every
    optimistic apply reads `state.categorias` from the `set((state) => …)`
    callback (never a value closed over earlier), and every `write()`
    reads `get().config` fresh at the moment it's invoked — after the
    optimistic apply already ran — rather than the `previous` snapshot
    taken only for rollback. Proven by a test that fires two
    `upsertCategoria` calls via `Promise.all` against a repo mock that
    performs a real shallow merge (mirroring `repo.fake.ts`); both
    categories survive.
  - **Went one step further than the named edge case, and it's worth
    flagging:** the existing `updateConfig` action's `onSuccess` does a
    blind `set({ config: result })` — trusting whichever write's own
    return value arrives, not merging it into whatever the store holds at
    that moment. For `movimiento` actions this is safe (`onSuccess` merges
    one row into the array by id, matching `movimientos`' existing
    pattern), but for a single `Config` object it means two concurrent
    `Config` writes whose underlying repo calls **settle out of dispatch
    order** could have the earlier one's stale result clobber the later
    one's already-applied change — unreachable today with the in-process
    fake/local repos (write order and settle order coincide), genuinely
    reachable once `repo.drive.ts` (Track Z) introduces real network
    latency. The three new actions above avoid this by merging their own
    category back into the freshest `get().config` inside `onSuccess`
    instead of trusting the write's raw return value — but `updateConfig`
    itself still has the blind-overwrite shape, and it is **not fixed
    here**: `runMutation`/`updateConfig` are shared, pre-existing surface
    outside this stage's file ownership, and touching them is a
    cross-cutting call for the operator, not a G1 stage-2 decision. Filed
    to §12.
  - `bun run check` green (969 tests).

## 12. Backlog (pending verification / deferred work)

- **`dataStore.updateConfig`'s `onSuccess` blindly trusts its own write's
  return value (`set({ config: result })`) instead of merging into the
  freshest store state.** Found by Track G1 while building
  `upsertCategoria`/`archiveCategoria`/`deleteCategoria` (§11, 2026-08-20),
  which avoid the shape for their own field (`categorias`, merged by id) but
  don't fix the general-purpose `updateConfig` action itself. Two concurrent
  `Config` writes whose underlying repo calls settle **out of dispatch
  order** — impossible today with the in-process fake/local repos, where
  settle order always matches dispatch order, but plausible the moment
  `repo.drive.ts` (Track Z) adds real network latency — would have the
  earlier dispatch's stale result silently overwrite the later one's
  already-applied change in the store (though not in the repo itself, which
  each call still writes to independently). Two shapes of fix, unevaluated
  here: give `onSuccess` a per-field merge the way the new categoria actions
  do, generalized across whichever fields the patch actually touched; or a
  version/generation check that refuses to apply a stale write's result over
  a newer one. Whoever picks this up should re-check it against
  `repo.drive.ts`'s actual latency characteristics once that track lands,
  not just in the abstract.

- **The lock feature is not internationalised at all.** `LockScreen`,
  `LockSettings` and `src/features/lock/errorCopy.ts` still hold hardcoded
  Spanish, five Wave 2 tracks after `src/lib/i18n` landed. Whoever retrofits
  it should route both the copy and the error table through the table in one
  pass, and `errorCopy.ts` should return a translation key the way
  `src/features/auth/errorCopy.ts` now does.

- **`authGeneration` is checked in only one of five state-setting async auth
  paths.** `connectDrive` and the silent Drive re-acquire check it; `login`,
  `restore`, `hydrate` and `syncLockedSession` do not. Pre-existing and not
  currently reachable in a harmful way, but a generation guard that one path
  honours and four ignore is a latent inconsistency worth closing
  deliberately rather than incidentally. Found during the Wave 2 review of
  Track J.

- **`MovimientoRow` has no amount-masking prop**, so History could not
  implement the design's hide/show-amounts toggle (Track E4, deferred — it is
  a shared component no Wave 2 track owned). Wave 3 should add it alongside
  whichever track next opens that component.

- **Search result rows do not open anything** (`// STUB(trackF)`): the
  Movement view/edit sheet is Wave 3. Once it exists, revisit encoding the
  Search filter state in the URL — deliberately skipped in Wave 2 because
  there was nothing to link to and the `replace`-per-keystroke vs
  `push`-per-filter-tap distinction is real complexity (Track E3).

- **No Drive-backed `Repo` implementation exists — the largest structural gap
  (found while scoping Wave 2, 2026-08-19).** `bootstrap.ts` provisions
  `movimientos.json` / `activos.json` / `config.json`, and `repo.local.ts`
  reads and writes dexie, but no code path connects the two: the Drive files
  are created and then never touched again. Every Wave 2 screen therefore
  reads `repo.fake` through `src/lib/repoProvider.ts`'s single
  `// STUB(wave3)` line. Wave 3 needs a `repo.drive.ts` behind the same port
  (it already has a shared contract suite, `repo.contract.ts`, so a new
  implementation cannot ship without its error behavior being exercised) plus
  a sync/conflict story that does not exist yet.

- ✅ **The PIN lock has a production entry point** — closed 2026-08-19
  (Track Y). `LockSettings` moved off the dev-only `/kit` route into
  `src/features/profile/SecuritySection.tsx`, reachable from `BottomNav`'s
  Profile slot in every build. Verified by running the app, not only by
  reading the code. Its own copy is still hardcoded Spanish (the lock-i18n
  item above, unchanged) — moving it into an otherwise-translated sheet made
  that gap **more** visible, not less.

- **Toast (§10.6) blocks Wave 2 — build it before the screen tracks, not
  inside one of them.** `docs/ui/implementation-plan.md` files it under the
  Movement sheet (Track F), which would leave E, G and H with no surface for
  an error raised after a sheet closes — and four parallel tracks with no
  shared surface invent four. No UI consumes `Repo` yet, so nothing is
  broken today; the moment one does, a failed write has nowhere to land.

- ✅ **Login verified end-to-end (§10.1)** — 2026-07-02. Real OAuth ran against Google
  with a Testing-mode client (`http://localhost:5173` origin, dev Gmail as test user):
  identity-only consent (name + email, **no Drive**), reached `authenticated`, no Drive
  writes. Production domain / app verification remains a later, production-only concern.
- ✅ **Drive-sync opt-in UI (§10.1) closed** — 2026-08-18 (Track B, Wave 1).
  `DrivePermissionScreen` is the real caller for `authStore.connectDrive`, wired
  through `RequireAuth` right after login; `WelcomeScreen` replaces the bare
  `LoginScreen`. Both built from the Claude Design canvas's own screens. See §10.4.
- **Verify `connectDrive` against real Drive (§10.1 "Done when — connectDrive").**
  Still unverified at runtime: the screen that calls it now exists, but nobody has
  run it against a live Google account. Needs a human in the OAuth popup, so it
  can't be agent-verified. Check: first call → `KuroBello` folder + 3 files;
  second call reuses them (no dupes, find-before-create).
- ✅ **PIN-lock activation (§10.2) fully wired** — both sub-items below are done, so
  §10.2's "Done when — Activation" is met:
  1. ✅ **Enable-lock UI (minimal)** — 2026-07-02. `LockSettings` on `Home` collects a
     4-digit PIN + optional biometric → `lockStore.enable`, plus "Lock now" (`lockStore.lock`,
     new manual re-lock action) and "Desactivar" (`reset`). `lockStore` gained an `enabled`
     flag so the UI knows the vault state. This is a **dev/test harness**, not the polished
     settings UI — that still rides with the polished-UI spec.
  2. ✅ **`updateSession` wiring** — 2026-08-18 (Track B, Wave 1). Wired into
     `login`/`restore`/`hydrate`/`connectDrive` in `authStore` via a
     `syncLockedSession` helper that no-ops when no vault exists and never fails the
     auth flow it rides on. Without it the cached token went stale after first expiry
     and every cold start forced a Google re-login, so the lock gave no convenience.
- **Rename the OAuth consent screen to the current brand** (user, in Google Cloud
  Console → Google Auth Platform → Branding → App name → "KuroBello"). Client ID
  and origins are untouched — no code change. In Testing mode the change is
  instant, no re-verification.
- **App icon for the brand.** The PWA still ships the scaffold `favicon.svg`;
  a KuroBello icon (maskable + favicon) is pending. Cosmetic, not blocking.
- **Drive-sync opt-in persistence + screen refinements.** See
  `docs/waves.md` Track J — the "Ahora no" dismissal deliberately doesn't
  persist today (in-memory, per-session only, see §11 2026-08-18); Track J
  fixes that plus trims/resizes the screen and adds reassurance copy.
- **Persistent Drive-sync toggle (follow-up from §10.4/§11 2026-08-18,
  Track G, Wave 2).** The "Ahora no" dismissal deliberately doesn't persist
  (per-session only, see §11). Once the Profile sheet exists, add a Drive
  row there that reads `authStore.drive`/`driveOptIn` and can call
  `connectDrive()` on demand — the "turn it back on" counterpart that makes
  a persistent "don't ask again" viable later, if ever wanted.
- **The region-derived currency has no observable effect in the running app
  yet.** `repoProvider.getRepo()` returns `repo.fake` unconditionally
  (`// STUB(wave3)`), and `repo.fake`'s `FAKE_CONFIG` hardcodes `COP` by
  spreading `CONFIG_SEMILLA`. Both real seeding paths (`repo.local.ts`,
  `bootstrap.ts`) are correctly region-derived and tested, so the feature is
  complete and correct — it simply cannot be seen until the Drive-backed
  `Repo` lands. The _formatting_ half (symbol, sign placement, grouping) is
  visible today. Note that making the fake repo region-aware would mean
  building it at module-import time, the defect shape §11 records twice, so
  it needs a lazy `getRepo()` rather than a one-line change.

- **`logout()` never calls `lockStore.lock()`, so a same-tab logout leaves
  the vault's DEK resident in memory.** Pre-existing, not introduced by the
  guest work, and found while verifying that a guest cannot bypass the PIN
  lock. Not a remote-attacker issue — it needs local access to a running
  tab — but "logging out" plainly implies the vault re-locks, and today it
  does not. Small, self-contained fix; worth doing before any release.

- **`HistoryScreen`'s `semana` scope can render the seed default's week
  boundary and then visibly change** once the real `Config` resolves with a
  different `primerDiaSemana`. Reproduced with a test (kept, as a
  characterization of current behaviour). **Unreachable today**: nothing can
  write `primerDiaSemana`, so it is always the seed's `1` for every real
  user. It becomes reachable the moment a preferences screen lets a user
  pick a different week start — so this is a **prerequisite of Track G**
  (Wave 3), not free-floating debt: whoever ships the week-start preference
  fixes this in the same change. Deliberately not fixed now — every
  available fix (gating the week chrome behind the load, or deriving the
  default from locale week-info) adds real UX or a second source of "what's
  the default" for a bug that cannot currently occur.

- **Accepted risk: until Drive sync ships, local data can be lost with no
  recovery path.** A browser evicting IndexedDB, Safari private mode, or a
  lost device destroys everything, and — following the 2026-08-19 decision
  above — there is deliberately no backup file to restore from. This is a
  **known, accepted window**, not an oversight, and the way to close it is
  Drive sync (Wave 4), not an export. Two things follow: the window's length
  is ours to control, so Drive should not drift late; and a **guest is
  permanently inside it by design**, which is why the guest reassurance copy
  says so out loud. Revisit only if Drive slips far enough that the window
  stops being temporary.

- **The light theme has no category colors at all — the `chart-*` tokens are
  still the scaffold's zero-chroma greys.** `src/styles/index.css` defines
  `--chart-1..5` as `oklch(0.87 0 0)`…`oklch(0.269 0 0)` in `:root` (light)
  while `.dark` carries the design's real palette (`#2fd896`, `#7ba7f0`,
  `#f5b93f`, `#fb8989`, `#c084fc`). Every category tint therefore renders
  grey in light mode — the movement-row avatars, the tag chips, and the
  History breakdown bars alike. Since `preferencias.tema` defaults to
  `sistema`, a user on a light OS gets a colorless app and the
  "scan by color" affordance silently does not work. Pre-existing, not
  introduced by any Wave 2/2.1 track, and it needs **design values**, not a
  code decision: the design canvas is dark-only today. Blocking for anyone
  who ships light mode; harmless until then.

- **`BreakdownCard.tsx` still owns a fourth private copy of the tint → token
  mapping** (`FILL_CLASS`, from Track E4). `tintClasses.ts` now holds the
  single source for `IconAvatar` and `TagChip`; folding `BreakdownCard` in
  needs a `bar`/`fill` shape added to that table. Left alone deliberately —
  it was outside Track O's scope and its own feature was not being touched.

- **A selected `neutral` `TagChip` is weakly distinguishable in dark mode.**
  Measured, not eyeballed: the selected and unselected backgrounds differ by
  1.06:1, so the whole signal rides on a border-alpha step (0.04 → 0.1) and a
  text-brightness step of ~1.48:1 self-contrast. Both states are individually
  legible; they are just not strongly different from each other. `neutral` is
  the fallback tint for a custom category with no entry in `CATEGORY_TINT`,
  so this affects user-created tags specifically. Strengthening it (a heavier
  border, a different selected surface) is a design-weight call, not a bug
  fix — deliberately left for a design decision rather than changed
  unilaterally.

- **`DateChipPicker`'s aria-labels are still hardcoded Spanish**
  ("Mes anterior", "Mes siguiente", "Selector de fecha") — the component has
  no assigned locale namespace, so Track M (a formatter-wiring track)
  deliberately left them. A non-Spanish screen-reader user hears Spanish
  button names in the Search filter sheet's custom date range, while the
  day-cell labels around them are localized. Whoever next touches this
  component for copy should pick a namespace and retrofit them the way
  Track I did for the Wave 1 screens.

- **"Doc lines to add" in a track report is a checklist to execute, not a
  section to read.** `docs/wave-2-plan.md` §1.2 makes an existing folder's
  `README.md` operator-owned for the whole wave, so tracks correctly hand
  their doc edits over instead of applying them — which means the operator
  is the single point of failure for every directory doc. Track M's five
  README edits sat unapplied until its reviewer caught them, and two lines
  in `src/components/shared/README.md` were by then actively false. The
  reviewer initially filed this against the track, citing `AGENTS.md`'s
  generic "update the README before calling the task done" without the
  wave's own override — worth noting as its own small lesson about reading
  the project's rules before the generic one.

- **Neutral `es` formats numbers as `es-CO` for every country it covers.**
  `localeFormatting.ts` maps the neutral Spanish copy locale to the `es-CO`
  tag, so a Mexican or Peruvian user reading neutral Spanish sees Colombian
  grouping (`1.234,56`, not `1,234.56`). Deliberate — it preserves the
  formatting every amount already had, and the currency itself comes from
  `Config.preferencias.monedaPrincipal` either way. Revisit when a Settings
  language/region picker exists (Track G, Wave 3): region is the right input
  for number formatting, and it is not the same choice as the copy language.

- **Review dispatch races a moving `main`.** Both Wave 2 reviewers reported
  the same process gap independently: a worktree briefed as "already rebased
  on `main`" went stale mid-review as other tracks merged, and one of them
  produced a `git reset --soft main` diff that appeared to revert files it
  had never touched — caught by reading `git status` by hand, not by any
  tooling. The rule that fixes it is cheap: **re-diff against `main`'s tip
  immediately before the final squash**, and treat one rebase as insufficient
  rather than sufficient. Whether review dispatches should instead serialize
  against in-flight merges is still open.

- **`DateChipPicker` `min`/`max` date bounds — deferred (Track D follow-up,
  2026-08-18).** Explicitly out of scope for the code-review pass: no
  screen has asked for a bounded date range yet, so adding the prop now
  would be speculative. Revisit once a Wave 2 screen actually needs it.

- ✅ **The Toast now has an action affordance and the update prompt uses it**
  — closed 2026-08-19 by the Wave 3 cross-track review. `ToastItem` gained an
  optional `{ labelKey, onAction }`, and §10.16's "a new version is
  available" notification is takeable in one tap, which closes that spec's
  last "done when". `onAction` is `() => void`, not async: a caller whose
  action is asynchronous self-catches first, so `Toast.tsx` never has to know
  about promises (`docs/error-handling.md` §7).

- ✅ **`button.tsx` has 44px-compliant sizes** (`touch` / `icon-touch`) —
  closed 2026-08-19 by the Wave 3 cross-track review, additively, with the
  existing variants unchanged. The per-call-site `min-h-11` workaround is
  gone from both `Button` call sites that carried it (`ConfirmDialog`,
  `LockSettings`); the remaining `min-h-11`s in the tree are on raw elements,
  not the component, and are correct where they are.

- ✅ **`parseAmount`/`formatAmountForInput` live in `src/lib/i18n/`** —
  closed 2026-08-19 by the Wave 3 cross-track review. They are pure locale
  logic with no React in them, so they now sit next to `localeFormatting.ts`
  rather than under `components/`, where they had landed only because that
  was the directory one track happened to own.

- ✅ **CSV export has a caller-visible error surface** — closed 2026-08-19
  (Track Y). `src/features/profile/DataSection.tsx` is the button; it catches
  `exportMovimientosToCsv()`'s rejection and routes a `RepoError` through the
  existing `home:error.codes.*` copy, anything else through one generic
  `profile:data.exportFailed` toast (`docs/error-handling.md` §7).

- **No `Activo` export.** §10.12's title and user story are scoped to
  movements only. Asset export would be a new §10.x, not implicit in that one.

- **If the profile registry is ever synced across devices, revisit its
  monotonic-timestamp fix.** `getActiveProfile()` compares `lastUsedAt`
  among profiles local to one device, where the only hazard was same-tick
  ties (found and fixed by TDD in Track V). Real clock skew between devices
  is a different problem, and the current fix does not address it.

- ✅ **The device-scoped databases are consolidated into `kurobello-device`**
  (v3, additive) — closed 2026-08-19 by the Wave 3 cross-track review, which
  verified the "never shipped, so no migration is owed" premise itself rather
  than taking it on trust. `networkStore` and the profile registry keep their
  public APIs and their degrade-to-no-signal posture; only the storage
  backing moved. See the process lesson in §11.

- **Accepted limitation: the 7-hour offline window compares wall-clock
  time.** `canWrite()` measures `Date.now() - lastOnlineAt`, so a device
  clock change moves the boundary: backwards silently extends the
  offline-create grace period, forwards can block a legitimate offline
  create early. Both directions are benign — no data loss, no security
  consequence, worst case an annoying false block the user clears by
  reconnecting. Recorded rather than fixed because there is no trusted time
  source available without a backend (§6), so this is the honest cost of the
  no-backend architecture, not an oversight.

- **`syncLockedSession` is the one async auth path not gated on
  `authGeneration`**, verified deliberate during Track R's review. A stale
  write re-persists the same account's already-encrypted data under the same
  DEK — no cross-account leak and no lock bypass — so gating it would add a
  guard with nothing to guard. Noted so a future sweep does not re-file it
  as the missing fifth case.

- **A local write and its outbox entry are not atomic.** They are two Dexie
  writes, so a crash or a quota failure between them leaves a change that is
  materialized but unqueued — now surfaced to the user by a Toast rather than
  swallowed, but still a state that has to be reconciled rather than
  prevented. Making it atomic needs the _active_ repo and the outbox in one
  transaction, and today `getRepo()` returns the **in-memory fake**, so there
  is no Dexie write to wrap without extending the frozen `Repo` port. Revisit
  **together with the `repoProvider` stub flip** (Wave 4): that is the moment
  a real Dexie repo exists, and the moment the question becomes answerable
  rather than hypothetical.

- **The outbox targets the default `kurobello` database, not the active
  profile's.** Correct today — `getRepo()` is single-profile — and the table
  now lives on the per-profile database, so this closes itself the day
  `dataStore` writes through `getActiveProfileRepo()`. Listed so that day
  does not arrive silently.

- **The default profile's label is hardcoded `'Local'`, not localized.**
  `src/lib/profiles/profileRegistry.ts` mints it regardless of the active
  app language — confirmed by Track Y while running the app in English, and
  correctly left alone as another track's file. It is a stored value, not a
  render-time one, so localizing it means deciding whether the label is data
  (stored, editable by the user once renaming exists) or presentation
  (derived per render). That question belongs with Wave 5+'s profile
  switcher, which is what makes renaming real.

- ✅ **"Sign out" now signs the user out** — closed 2026-08-19 (Track AA,
  §10.20). `logout()` invalidates the vault, so a correct PIN afterwards
  reaches `WelcomeScreen` instead of resurrecting the account just left. The
  defect was traced by Track Y's review and reproduced with a failing test
  before the fix.

- **Sequencing constraint for the `repoProvider` flip: a guest who signs in
  will see an empty account.** §10.15 correctly decides that a guest's local
  profile stays untouched, side by side, when they later sign in — nothing is
  merged or overwritten. The consequence is a usability cliff, not a data
  problem: a person who used the app as a guest for a month signs in and lands
  in a fresh Google profile, with their month sitting in a profile the UI
  cannot switch to, because the switcher is Wave 5+. **Unreachable today** —
  `getRepo()` still returns the fake repo — and it becomes real the moment
  that stub is flipped in Wave 4. Two acceptable answers: bring the profile
  switcher forward into Wave 4, or have the account screen say plainly where
  the guest data went. What is not acceptable is shipping the flip and leaving
  someone staring at an empty account, because the conclusion they will draw
  is that the app lost their data. Recorded before the flip so it is a
  decision, not a bug report.

- **A vault-invalidation failure on sign-out is logged, not retried.** If
  `resetVault()` throws (storage blocked, quota), the current tab still signs
  out cleanly — the state reset happens first, unconditionally — but the vault
  row can survive. A later cold boot that never saw the failure could then
  show a PIN screen for the old account. Narrow window, no retry or queue
  today, `console.error` the only trace.

- **`resolveGoogleProfile` never refreshes an existing profile's label** when
  the Google display name changes. Deliberate: updating a stored label from
  upstream identity is adjacent to Wave 5+'s renaming feature, not a
  side effect to add now.

- **`ConfirmDialog`'s confirm button is hardcoded `variant="destructive"`.**
  The sign-out dialog reuses it even though signing out keeps the data and is
  not destructive — a copy/styling mismatch, not a bug. Worth a variant when a
  second non-destructive caller exists, not before (Track U deliberately
  shipped without a `confirmVariant` prop for that reason).

- **A `config` operation carries the whole `Config`, so two devices can lose a
  category (found while specifying §10.22, 2026-08-19).** `outbox.ts`'s
  `{ entity: 'config'; op: 'put'; payload: Config }` means two devices each
  adding a category while offline replay as two whole-config `put`s, and the
  later one silently wins — the earlier device's category is gone with nothing
  reporting it. `Movimiento` ops do not have this shape because each movement
  is its own operation. **Unreachable today** (no sync engine exists) and
  deliberately not fixed in §10.22, because the fix is a finer-grained config
  operation, i.e. a change to §10.19's sync format. Belongs to Track Z or a
  follow-up; whoever takes it should check whether `Preferencias` needs the
  same treatment or whether last-writer-wins is genuinely correct there.

- **`schema.ts`'s `Movimiento.seccion` comment was wrong before §10.22 and
  nothing caught it.** The comment claimed a taxonomy _value_ ("Personal,
  Trabajo…") while every fixture stored an id. The process finding, which is
  worth more than the comment: **a field whose stored form is only asserted by
  fixtures has no enforcement at all** — `repo.contract.ts` and `repo.fake.ts`
  disagreed with each other for two waves and the full suite stayed green,
  because the contract suite never renders and the render sites never run
  against the contract fixtures. Any future field whose meaning is a
  convention rather than a type deserves either a branded type or a test that
  crosses that seam.

### Development waves (parallel tracks, sequencing, worktree log)

Moved to **[`docs/waves.md`](../docs/waves.md)** — the full wave/track plan
(what shipped in Wave 1, what's active in Wave 2, including the new i18n
scaffolding track and the Drive-permission refinement task) plus the
worktree log live there now, kept separate from this file's behavior/
decision record so wave sequencing doesn't compete for space with what's
actually decided. `specs.md` stays authoritative for decisions (§11) and
feature specs (§10); `docs/waves.md` is pure sequencing/status.
