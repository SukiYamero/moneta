# KuroBello — Specs (source of truth)

> **This file is the source of truth.** It describes what the product does and
> the rules that must hold — the business logic, what each feature is for, how
> it is meant to be implemented, and the traps worth knowing about.
>
> **It is not a log.** No history, no dates, no record of who decided what or
> which attempt came first. Reasoning belongs in the commit that makes the
> change; the change's _result_ belongs here, in the present tense. If reality
> and this file disagree, one of them is wrong — fix it, do not silently
> diverge.
>
> Keep entries short. A feature needing more than ~20 lines here is either two
> features, or is being narrated instead of specified.

Schema version: **1**

Display brand: **`APP_NAME`** in `src/lib/branding.ts` (currently "KuroBello",
provisional and expected to change freely). Storage identifiers are frozen at
the 2026-08-18 baseline (`KuroBello` / `kurobello` / `kurobello-lock-dek`) and
do **not** follow later display renames; changing one orphans user data and
requires an explicit migration.

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
  (Radix primitives, Manrope font + Lucide icons). Components live in
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

Three logical stores, laid out in Drive as **per-device, append-only
operation logs** (§10.19). A single shared file per store cannot be written
by two devices without losing an update, and re-uploads the whole
history to record one entry):

- `Movimiento[]` — **flow** (in/out) → `mov-<device>-<YYYY-MM>.json` in the
  `KuroBello` folder, one shard per device per month; a closed year
  compacts to `mov-<device>-<YYYY>.json`.
- `Activo[]` — **balance** (what you own and what it's worth today) →
  `act-<device>.json` in the same folder (few enough that sharding buys
  nothing).
- `Config` (categories, preferences, schemaVersion) →
  `config-<device>.json` in the **appDataFolder** (syncs across devices).

Storage format is **JSON files** (only the Drive Files API under
`drive.file`); each file holds `put`/`del` operations, not the stores'
current state — see §10.19 for the full file table, the merge/replay rule,
and why. `LEEME.txt` (localized) and a yearly `movimientos-<YYYY>.csv` (via
`src/lib/export/csv.ts`, written by `sync/engine.ts`'s year-close
compaction) live alongside the `KuroBello` folder's files for anyone
opening the folder without the app. `bootstrap.ts` provisions the folder
and `LEEME.txt`; every op-log file itself is created lazily, on first
write, by `sync/engine.ts`'s push path — never pre-created.

Local cache of everything in IndexedDB (disposable; re-downloaded from Drive if
cleared). **The local database is always the merged truth**: the operation logs
are a storage and transport format, replayed once on download, and no screen
ever sees them.

**Mandatory conventions:**

- `monto` is ALWAYS positive; the sign comes from `tipo` (income adds, expense subtracts).
- `moneda` always present; UI fixes it to `"COP"` for now (field already supports multi-currency).
- `id` = app-generated uuid (not the row position).
- Dates in ISO (`yyyy-mm-dd`).
- Views are NOT stored: total, category breakdown and history are derived by
  grouping `Movimiento[]`.
- `schemaVersion` + `extra` = migration safety net. New fields go into `extra`
  (free JSON) first, before being promoted to a real column. Current version
  is 2, with no migration registered from 1 — the app refuses to boot against
  version-1 stored data.
- A `Categoria` is a name, an icon, a color and an optional `padreId` (the
  parent's id, absent for a top-level category) — no type, no section.

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
**stop** and resolve it cold instead of choosing on the fly, then record the
outcome as a rule in the relevant §10 entry.

## 10. Feature specs

### 10.1 Google login + Drive bootstrap

**Goal.** Sign in with Google for identity only; Drive access is a separate, later, opt-in step so the app works local-first without forcing Drive on first login.

**Rules.**

- Login requests identity scopes only (`openid email profile`); it never touches Drive.
- `connectDrive` is the only path that provisions Drive: creates the `KuroBello` folder, `movimientos.json`, `activos.json` (`[]`), and `appDataFolder/config.json` (seeded from `CONFIG_SEMILLA`).
- Repeated `connectDrive` calls must not duplicate the folder/files — find-before-create.
- `drive.file` and `drive.appdata` are requested together and required together — the consent screen lets a user uncheck either individually, so `requestAccessToken` checks `hasGrantedAllScopes` and treats a partial grant as a failure (revokes the token best-effort, rejects immediately with `partial_scope_grant` without waiting on `revoke`'s callback) rather than proceeding into a bootstrap that would fail confusingly partway through. This check runs only for the Drive scope request, never for `IDENTITY_SCOPES` — Google's basic OIDC scopes have no per-scope checkbox to begin with, and checking them risks rejecting every login outright if Google ever doesn't echo "openid" back as granted.
- The access token is never persisted unencrypted.
- `RequireAuth` blocks the rest of the app until authenticated.

**Implementation.** `src/lib/auth.ts` (scopes), `src/lib/bootstrap.ts` (provisioning), `src/features/auth/RequireAuth.tsx` (guard). §10.19 is authoritative for the actual Drive file layout `bootstrap.ts` provisions; this section's file list predates the per-device op-log format.

### 10.2 PIN lock + biometric unlock

**Goal.** Optional per-device lock protecting the cached Google token: biometrics (WebAuthn PRF) first, a mandatory 4-digit PIN fallback.

**Rules.**

- Unlock tries biometrics first, falls back to PIN; cold start and 7 minutes backgrounded both re-lock.
- The cached OAuth token is envelope-encrypted: one random DEK encrypts it, wrapped separately by `PBKDF2(PIN)` and by the WebAuthn PRF secret (HKDF).
- 5 wrong PIN attempts force a vault wipe + re-login with Google.
- No WebAuthn/PRF on the device → PIN-only, biometric option is not offered.
- A guest's biometric lock (§10.2.1) is a separate `guestLock` row, not this `LockVault` — no DEK, no envelope, no session to protect.
- Logout invalidates the cached session inside the vault (§10.20); offline unlock must not force a silent re-auth (see §10.11).
- Both `LockScreen` and `PinSetup` back their PIN dots with an `sr-only` `<input>` — `sr-only` clips it but leaves it real and focusable, so it still raises the OS keyboard on top of `PinPad`. That input carries `inputMode="none"`, same fix shape as `MovimientoAmountInput` (§10.54): the software keyboard is suppressed, `PinPad`'s own labelled buttons are the only on-screen entry surface, and a physical keyboard or screen reader still reaches the input.

**Implementation.** `src/lib/pinLock.ts`, `src/lib/lockStore.ts`; UI in `src/features/lock/` (`LockScreen`, `LockSettings`, `PinSetup`), reached from `SecuritySection` in the profile sheet (§10.18).

**Watch out.** `lockStore.enable({ pin, session, user, biometric })` throws `NO_SESSION_ERROR` when there is no session — envelope encryption assumes a token to wrap. This is exactly the wrinkle §10.2.1 has to design around for a guest.

### 10.2.1 The lock's two identities

**Goal.** A signed-in account gets the PIN (with biometrics as the fast path); a guest gets biometrics or nothing — never a PIN.

**Rules.**

- A guest lockout has no honest recovery (there is no Google to re-auth with), so a guest is never offered a PIN at all.
- Where the device has no biometric capability, a guest sees no lock option — not disabled, not erroring, absent.
- "Olvidé mi PIN" is not a new mechanism: it is the same vault-wipe-plus-forced-Google-re-login the code already performs after 5 failed attempts, now offered as an exit instead of discovered by failing. It is account-only by construction.
- A guest's biometric credential gates the UI only — it is not a cryptographic boundary, because the local financial database is not encrypted at rest for anyone. Do not let this quietly grow into encrypting the local database; that is a separate, undecided piece of work.

**Implementation.** `src/lib/deviceStore.ts`'s `guestLock` table (presence-only row, no DEK/envelope — a session-less path, not the existing `LockVault` with its PIN branch hidden). The biometric-offer UI (a toggle row inside `SecuritySection` plus the OS's own biometric prompt) is operator-designed from existing components; the design canvas has no biometric UI to extract from.

### 10.3 Data port (`Repo`)

**Goal.** One storage-agnostic contract for reading/writing `Movimiento`, `Activo` and `Config`, so every feature is built against an interface rather than a concrete storage engine (local IndexedDB and Drive-backed sync are both implementations behind it).

**Rules.**

- `movimientos`/`activos` share one generic `CrudRepo<T>` shape (`list`/`get`/`add`/`addMany`/`update`/`remove`/`removeMany`).
- `list()` takes an optional query (date range, sort, `limit`/`cursor`) — pagination is not a later retrofit.
- `Config` stays atomic (`getConfig`/`updateConfig`); it is not entity-scale data.
- Errors are a typed `RepoError` (`code: 'not_found' | 'schema_mismatch' | 'network' | 'unknown' | ...`), never a raw throw, so callers branch uniformly across implementations.
- `ready()` runs the `schemaVersion` check/migration before first use; every implementation exposes it.
- Empty store → `list()` returns `{ items: [] }`; missing `get()` → `undefined`; missing `update`/`remove` → `RepoError('not_found')`.

**Implementation.** `src/lib/repo.ts` — interface only (`Repo`, `CrudRepo<T>`, `RepoError`, `RepoErrorCode`). Concrete implementations: `repo.local.ts` (§10.3.1), `repo.drive.ts` (§10.19), `repo.fake.ts` (dev/demo).

### 10.3.1 Local (dexie) implementation — `repo.local.ts`

**Goal.** The dexie-backed `Repo` that every screen reads through today.

**Rules.**

- `ready()` runs exactly once per database connection, memoized in a `WeakMap<ProfileDb, Promise<void>>`; only a **rejected** attempt clears the memo, so retries don't replay schema-migration on every call.
- `update()`/`remove()` run read-check-write as one atomic `db.transaction('rw', table, …)` — a non-transactional version lets two concurrent updates silently lose one's write.
- `list()` has a fast path (indexed date field + `limit` given) that walks a bounded window off a compound dexie index (`[fecha+createdAt]` / `[fechaActualizacion+id]`), and a slow path (`listSlow`) for everything else — the fast path never materializes the whole table. The compound index must include the tiebreak field, not just the date field, or same-day rows can silently skip/duplicate across pages.
- `TIE_SAFETY_MARGIN` (32): the fast path over-fetches `limit + 1 + 32` rows to discard already-returned ones; if that still can't prove there's no more data, it returns `null` and `list()` falls back to `listSlow`, which is always correct.
- `addMany`/`removeMany` run inside one transaction — all-or-nothing; a partially committed financial import is worse than a fully rejected one.
- A duplicate `id` on write surfaces as `RepoError('invalid_input', …)` naming the offending id, matched only by `.name === 'ConstraintError'`/`'BulkError'` — never a broadened `instanceof Error` catch-all (Dexie's `BulkError.failures` entries aren't `instanceof Error`).
- Write validation: `monto` finite and `> 0`; dates a real ISO `yyyy-mm-dd`; `moneda` required; `Activo.valorActual` finite and non-negative; `list()` rejects `limit ≤ 0`/non-integer/`NaN`/`Infinity`; `updateConfig` rejects a patch explicitly setting `schemaVersion`. All as `RepoError('invalid_input')`, row never written.
- Reads/writes never hand back the literal in-memory object without a fresh spread — no aliasing between caller and stored state.

**Implementation.** `src/lib/repo.local.ts`, backed by `src/lib/db.ts`. `migrateSchema(from, to, registry)` dispatches through a `Record<number, Migration>` registry; `> SCHEMA_VERSION` is `RepoError('schema_mismatch')`, never a downgrade.

**Watch out.** A row inserted between two `list()` page fetches must never cause a skip or duplicate — this is what the fast path's value-tuple (not offset) comparison guarantees, and what the tests exercise directly.

### 10.4 Drive-sync opt-in + Welcome screen

**Goal.** Real onboarding: sign in with Google, then decide separately whether to turn on Drive sync.

**Rules.**

- `WelcomeScreen` triggers `authStore.login()` — identity scopes only, no Drive consent.
- `DrivePermissionScreen` is shown once per authenticated session right after login, before the rest of the app, and explains the two Drive permissions in plain language.
- "Permitir y continuar" calls `authStore.connectDrive()` with a busy state; failure shows an inline error and keeps both retry and "Ahora no" reachable. "Ahora no" dismisses without calling `connectDrive`.
- `RequireAuth` routes on `status`/`driveOptIn`: unauthenticated → `WelcomeScreen`; authenticated + `driveOptIn === 'pending'` → `DrivePermissionScreen`; `'connected'`/`'dismissed'` → the app.
- No hand-rolled Google account chooser is built — GIS's own popup already does this.
- A Drive failure never tears down the identity session — `status`/`error` are for identity auth only, `driveError` is separate.
- Re-locking/unlocking mid-session must never re-prompt the Drive screen.

**Implementation.** `src/features/auth/WelcomeScreen.tsx`, `src/features/auth/DrivePermissionScreen.tsx`, `RequireAuth.tsx`, `authStore.ts` (`driveOptIn`, `driveConnecting`, `driveError`).

**Watch out.** `driveOptIn` resets to `'pending'` on every fresh `login()`/`restore()`/`hydrate()`/unlock, but `resolveDriveOptIn()` immediately re-resolves a `'pending'` value from a persisted device-level decision before the first render — a returning user's earlier choice is honored without a visible re-prompt.

### 10.5 Shared UI kit + fake repo

**Goal.** The foundational, cross-feature component layer plus a shared in-memory `Repo` implementation every screen builds on, so look-and-feel and data are defined once instead of per-screen.

**Rules.**

- `BottomSheet`, `CenterModal`, `IconAvatar`, `MovimientoRow`, `TagChip`, `DateChipPicker`, `SegmentedControl`, `Toggle`, `InfoButton` are the only building blocks a screen composes from — never a per-screen reinvention.
- Every screen reads/writes through the shared `fakeRepo` singleton, never a screen-local mock — a write from one screen must show up on another.
- `repo.fake.ts` mirrors `repo.local.ts`'s `ListQuery` defaults, validation rules, comparator ordering and error codes exactly. A place where the fake silently disagrees with the real implementation is worse than no fake.
- `add`/`addMany` reject a duplicate `id` (`RepoError('invalid_input')`), aborting the whole batch; `removeMany` rejects any missing id, aborting the whole batch — symmetric with single-id `update`/`remove`.
- `list()` on an empty store returns `{ items: [] }`; `get()` on a missing id is `undefined`; `update`/`remove` on a missing id is `RepoError('not_found')`.
- `DateChipPicker` takes `firstDayOfWeek` as a prop rather than reading `Config` itself, keeping it repo-agnostic.

**Implementation.** `src/components/shared/**`; `src/lib/repo.fake.ts` (`createFakeRepo` + the `fakeRepo` singleton). Dev-only gallery at `src/routes/Kit.tsx` (`/kit`, `import.meta.env.DEV`-gated).

### 10.5.1 Overlay stack + touch-target/API fixes

**Goal.** Overlay nesting, focus, and touch targets behave correctly once more than one `BottomSheet`/`CenterModal` can be open at a time.

**Rules.**

- `useOverlay.ts` keeps a module-level stack of every open overlay, ordered by a `seq` assigned at first render (not open/close timing) — only the topmost handle reacts to Escape, traps Tab, and claims initial focus; the body-scroll lock is refcounted against the stack.
- `useEscapeToClose` (exported) is the lighter sibling for a surface that isn't a full portal/scroll-lock/focus-trap shell (`DateChipPicker`'s inline popover), sharing the same stack so Escape closes the innermost thing first.
- `initialFocus?: RefObject<HTMLElement | null>` lets a caller focus a specific element on open instead of the panel's first focusable descendant.
- `ref` is accepted and forwarded on `BottomSheet`, `CenterModal`, `TagChip`, `Toggle`, `InfoButton`, `SegmentedControl`, `DateChipPicker`, `MovimientoRow`.
- Every interactive control keeps a real ≥44px touch target via an invisible-padding wrapper around a visually smaller pill/icon, never by inflating the visible chip itself. `disabled` is supported on `TagChip` and per-option on `SegmentedControlOption`; arrow-key nav skips a disabled option rather than making it reachable but inert.
- `movimientoView.ts`'s `Intl.NumberFormat` instances are memoized per `Moneda` at module scope, never built per row per render.
- `BottomSheet`'s drag-to-dismiss feature-detects `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` (`?.()`); `pointercancel` resets drag state without checking the dismiss threshold (a cancelled gesture is never dismiss intent); `lostpointercapture` is the catch-all for a drag that ends outside the window.

**Implementation.** `src/components/shared/useOverlay.ts` also exports `FOCUSABLE_SELECTOR` and the `OverlayShellProps<T>` type both shells' public `Props` re-export, and `useHasOpenOverlay()` (§10.53) — the same stack exposed via `useSyncExternalStore`.

### 10.6 Toast — the global notification surface

**Goal.** Any code can push a short message that reaches the user even when no screen owns the failure.

**Rules.**

- Toasts stack in arrival order; concurrent toasts never replace one another, and each keeps its own independent dismissal timer.
- Sits above every overlay (`z-[60]`, above the shells' `z-50`) and clear of the safe-area insets and the bottom nav.
- Swipe-to-dismiss via Pointer Events plus a keyboard-reachable close button — a timed message must stay dismissible without the gesture (WCAG 2.2.1).
- It is a notification, never a dialog: it never blocks, traps focus, or asks a question — anything needing a decision is a `CenterModal`.
- Errors announce assertively (`role="alert"`); confirmations politely (`role="status"`).
- Must never render while the app is locked — a notification about data is content, and the lock exists to hide content.
- Holds no domain state and reads no other store; `AppLock` drives its suppression while locked, not the store itself.
- Never renders a raw `.message` — Spanish copy only, per `docs/error-handling.md`.

**Implementation.** `Toast.tsx` (the card) + `Toaster.tsx` (the stack, portals to `document.body`, mounted once inside `AppLock` while unlocked); the store lives in `src/lib/toastStore.ts`.

### 10.7 Region-aware formatting + the initial currency

**Goal.** Money and dates format for the device's region, not the copy language, and a first run gets the region's real currency instead of a hardcoded default.

**Rules.**

- Region comes from the region subtag of `navigator.language`/`navigator.languages` (`es-MX` → `MX`); the copy locale (`detectLocale`) is a separate, independent axis and is unaffected.
- The initial `Config.preferencias.monedaPrincipal` derives from that region (`MX`→MXN, `AR`→ARS, `BR`→BRL, `PE`→PEN, `CO`/unknown→COP, `EC`/`US`→USD) and applies **only when seeding a config that does not exist yet** — a stored `Config` always wins.
- Currency always renders as a symbol (`Intl` `currencyDisplay: 'narrowSymbol'`), never the ISO code, even though this means `$` is ambiguous across COP/MXN/ARS/USD (accepted: one currency shown at a time).
- The sign attaches to the number, not the currency symbol: `$ -12.000,00`, never `-$ 12.000,00`. Build via `formatToParts`, never by string-prepending — symbol position is locale data (`R$` leads in pt-BR).
- `CONFIG_SEMILLA` stays a static constant; the region-derived currency is applied by the seeding function, never computed at module-import time.
- Both seeding paths (`repo.local.ts` and `bootstrap.ts`/`seedConfig.ts`) must apply the region default — fixing one and not its twin is the standing expensive-mistake shape for this project.

**Implementation.** `src/lib/i18n/regionCurrency.ts` (`monedaForRegion`, a plain `Record` lookup, `COP` fallback); consumed by the seeding path, not by `CONFIG_SEMILLA` directly.

**Watch out.** A negative `totals.balance` flows through the same formatter, so the sign rule lives in the formatter, not at each render call site.

### 10.8 Category color in `TagChip`

**Goal.** A category's color is one fact shown consistently everywhere it appears, not just on movement rows.

**Rules.**

- A chip's icon always carries the category's tint, selected or not.
- Selecting a chip tints the whole pill (border/background/text) in that same tint family — never a uniform "selected = primary" treatment.
- Unselected chips keep a neutral surface; only the icon is colored.
- A category with no tint of its own falls back to the `tipo`-based fallback tint — the same fallback used everywhere else, not a second rule.
- `neutral` as a tint must still read visibly as selected.
- The 44px touch target grows via padding on the button; the visible pill itself does not grow (§10.5.1's split).

**Implementation.** `src/components/shared/TagChip.tsx` renders `tint: IconAvatarTint` as a required prop (compile error if a call site forgets it, deliberately no default) using `TINT_CLASSES` from `src/components/shared/tintClasses.ts`. Which tint a category gets is resolved once, centrally — see §10.22 (`getMovimientoVisual`) — `TagChip` only paints, it never maps.

### 10.9 Loading states — the three tiers

**Goal.** The app never looks frozen, and never flashes a loader for work that finishes fast — `dataStore.load()` runs once per session, so most screens have nothing to wait for.

**Rules.**

- Tier 1 (screen): a full-screen `ScreenLoading` only for a lazily-loaded route's `Suspense` fallback — never for boot, never for a tab change.
- Tier 2 (section): a `Skeleton` matching the loaded layout so content fills in rather than reflowing; the chrome around it never disappears.
- Tier 3 (action): the busy state lives on the control that was pressed (disabled, label swapped, or an inline spinner) — never a full-screen overlay or blocking modal.
- The anti-flash gate (`usePendingDelay`): don't show a loader until work has been pending ~150ms; once shown, keep it ~350ms minimum so it can't blink.
- A refresh of data already on screen shows the stale content, never a skeleton — only a first load has nothing to show.
- A loader must never outlive its cause: an errored load replaces the skeleton with the error state, never left spinning.
- A skeleton is `aria-hidden` decoration plus one `sr-only role="status"` announcement, not one per block.

**Implementation.** `ScreenLoading.tsx`, `Skeleton.tsx`/`SkeletonGroup`, `usePendingDelay.ts` (`src/components/shared`). `WelcomeScreen`/`DrivePermissionScreen` are the sole exception allowed to block the whole screen on their one action — no content underneath to protect, and the OAuth flow is genuinely modal.

**Watch out.** Boot renders no full-screen loading treatment at all — `RequireAuth` composes `PreContentSkeleton` directly (§10.29).

### 10.10 Guest entry

**Goal.** A person can use the app without a Google account — identity is a sync feature, not a gate, since the data layer is local-first regardless.

**Rules.**

- Guest skips both the login and the Drive-permission screen entirely.
- Guest is a distinct state, never a synthesized `user`/`session` — anything reading `user` must be able to tell there isn't one.
- `driveOptIn` must never sit `'pending'` for a guest, or the Drive screen reappears on every boot.
- The UI must say the data is local to this device — the failure mode worth a line of copy is a guest who assumes they're synced and then loses the device.
- Guest reads through the same repo every other screen uses; no second data path.

**Implementation.** `WelcomeScreen.tsx` shows the Google button as primary and a secondary guest button (`GuestSignInButton.tsx`) below an `or` divider, with generous separation between the two zones. Copy goes through the `auth` i18n namespace.

### 10.11 Offline entry, network state, and the offline session window

**Goal.** The app opens and works with no network, and is honest when it can't do something — the "offline-first" claim (§3) must actually hold.

**Rules.**

- Cold boot must not strand the user on `WelcomeScreen` when offline: `authStore.restore()`/`hydrate()` must decrypt the vault and reach the app locally without requiring a network round trip.
- A profile fetch (name/avatar) is a refresh, never a gate — the vault already proved identity locally.
- One store owns online/offline state (`navigator.onLine` plus the `online`/`offline` events); everything else reads it. Treat `navigator.onLine === true` as a hint, not a guarantee — a failed request should downgrade it.
- **Offline session window: 7 hours from the last successful online validation.** Offline, the user may read everything, create movements and delete them, but not edit or change settings. Creates commute across devices (UUID ids) and a delete is terminal, so both converge; a record-level last-write-wins edit can still silently drop one of two concurrent field edits, so editing stays online-only.
- Past the 7-hour window, new writes are blocked (reads stay available) and the app asks the user to reconnect; copy must never imply data loss.
- All three screens (Home/Search/History) share one failed-load message, derived from `RepoErrorCode`, not three ad hoc strings.

**Implementation.** `src/lib/networkStore.ts` (`OFFLINE_WRITE_WINDOW_MS = 7 * 60 * 60_000`), `src/lib/authStore.ts`, `src/lib/pinLock.ts`, `src/lib/errorCopy.ts` (maps `RepoErrorCode` → copy, shared across screens).

**Watch out.** An expired token with valid local data must stay read-only, never bounce to login; a guest never sees a reconnect prompt (no token to reconnect); the lock's own error path must distinguish "wrong PIN" from "no network."

### 10.12 CSV export — "download your movements"

**Goal.** Let the user pull their movements into a spreadsheet. Not a backup, not a restore path, no import.

**Rules.**

- No JSON backup/restore and no import — deliberately rejected; the data-safety answer is linking Google Drive, not a file the user has to remember to make.
- **UTF-8 BOM required** — without it Excel mangles accents (`Café` → `CafÃ©`).
- **Separator `;` with a leading `sep=;` line** — Excel under a Spanish locale expects `;`.
- **Decimal comma** paired with the `;` separator, using the active locale's formatter (§10.7) — never a hand-rolled number string.
- **CSV injection guard:** a field starting with `=`, `+`, `-` or `@` (free-text notes, category names) must be escaped/quoted so it isn't executed as a formula by Excel/Sheets.
- Dates go out as ISO `yyyy-mm-dd`.
- On iOS, use `navigator.share({ files })` where available rather than a plain `<a download>`, which tends to just open a tab.
- The file must never contain the OAuth token, vault material, or lock data.

**Implementation.** `src/lib/export/csv.ts`, triggered from the profile sheet's Data section (§10.18). Reads through the existing `Repo` port. §10.19's yearly Drive compaction reuses this exact module for its yearly CSV — never a second CSV implementation.

### 10.13 The write path

**Goal.** One shared way to mutate data, so every feature doesn't invent its own optimistic-update/rollback convention.

**Rules.**

- Mutation actions (create/update/delete a `Movimiento`, update `Config`) live on `dataStore`, not scattered per screen.
- A failed write must roll back the store rather than leave it silently dirty.
- The repo write lands before the outbox append, never the reverse: a repo failure must not depend on the outbox, and an outbox failure must not roll back a write that already succeeded.
- Errors surface through the Toast (§10.6) for a write issued from a sheet that has since closed.
- The offline permission window (§10.11) is enforced in exactly one place — inside the write path, not per call site.

**Implementation.** `src/lib/dataStore.ts`.

### 10.14 Form primitives + confirm dialog

**Goal.** A shared set of form building blocks so every sheet/form in the app validates and looks the same, instead of each screen inventing its own.

**Rules.**

- An amount/numeric field parses and formats through the active locale's rules (see §10.23/§10.45's parser) — never a hand-rolled separator table.
- Every field carries proper label association and `aria-describedby` for its error text.
- A confirm dialog is built on the existing `CenterModal`/`useOverlay` stack — it must never reimplement Escape, focus-trap or scroll-lock itself.

**Implementation.** `src/components/ui/input.tsx`/`label.tsx` (shadcn primitives), `src/components/shared/TextField.tsx`, `src/components/shared/ConfirmDialog.tsx` (on `CenterModal`).

### 10.15 Local data scoping — profiles

**Goal.** Local data belongs to a specific profile, not to "whoever opens the app next."

**Rules.**

- One dexie **database per profile**, not a `profileId` column on every row — isolation at the connection level, and deleting a profile is deleting a database.
- The existing `kurobello` database is adopted as the first profile, never migrated; `AGENTS.md` freezes that identifier, additional profiles get a suffixed name.
- A device-scoped registry lists profiles: id, label, kind (`'local' | 'google'`), created/last-used timestamps, database name.
- `repoProvider.getRepo()` binds to the active profile — every screen already reads through `getRepo()`, so switching profiles touches no screen and no `schema.ts`.
- Nothing is ever replaced: signing into an account that already has data results in **two profiles side by side**, never a merge or overwrite as a side effect of signing in.
- Consolidation (moving local data into an account) is an explicit user action, implemented as a union by `id` (safe because every `id` is a `crypto.randomUUID()`) — it cannot resolve semantic duplicates (the same purchase entered twice), so it must be reviewable, never silent.

**Implementation.** `src/lib/db.ts` (parameterized database name), `src/lib/profiles/profileRegistry.ts`, `src/lib/repoProvider.ts`.

### 10.16 Service-worker update lifecycle

**Goal.** A deploy doesn't break a user mid-session.

**Rules.**

- A new version must not take over silently — the old tab can 404 on a lazily-loaded chunk against the new deployed manifest.
- Show a non-intrusive "a new version is available — reload" Toast (§10.9 Tier 3), never a blocking modal.
- Don't nag on every navigation, and don't reload out from under a user mid-input.

**Implementation.** `src/lib/swUpdate.ts`, `vite.config.ts`.

### 10.17 Local diagnostics log

**Goal.** When a user hits a bug, someone can see what happened, given there is no backend to log to.

**Rules.**

- A capped ring buffer in IndexedDB (bounded rows, oldest evicted) holds error code, a short context string, and a timestamp.
- Never logs a token, PIN, vault material, or raw user data.
- A logging failure must be swallowed, never thrown into the path it's logging.
- Exportable through the CSV export mechanism (§10.12) so it can be attached to a bug report.

**Implementation.** One module alongside the existing `console.*` call sites.

### 10.18 Profile / account screen — the access point

**Goal.** One reachable place for account, profiles and settings — the production entry point for features that otherwise have nowhere to live.

**Rules.**

- Opens as a bottom sheet (`BottomSheet` + `useOverlay`, `animate-sheet-up`, safe-area insets) from an avatar/entry point in the shell.
- Sections: **Identity** (Google account or "Invitado" + sign-in row), **Profiles** (§10.15's registry, active one marked), **Security** (`LockSettings`, moved off the dev route), **Data** (export button), **Preferences** (theme/language/currency/week start).
- Any row with no real implementation renders as a visibly inert stub (`// STUB(waveN): ...`) — never a control that looks tappable and does nothing.
- Preferences are read-only until the write path (§10.13) exists for them — no second write path invented here.
- The sheet must scroll inside its own `max-h` and clear the safe area rather than pushing the bottom nav off-screen.

**Implementation.** `src/features/profile/**` (`ProfileSheet.tsx` composes `IdentitySection`, `ProfilesSection`, `GuestAdoptionSection`, `SyncSection`, `SecuritySection`, `DataSection`, `PreferencesSection`).

### 10.19 Drive sync — the file layout and the merge rule

**Goal.** The user's data reaches their Drive and comes back on any number of devices, without a backend, without losing a record, and without re-uploading the whole history to log one coffee.

**Rules.**

- A Drive data file is an **append-only list of operations**, not a list of `Movimiento`s: reading = replay every op from every file in logical order, last `id` wins. `schema.ts` stays untouched — `hlc`/`basedOn`/`op` live only in the envelope. A `put` carries the whole record, never a diff, so a correction to an old month is self-sufficient in whichever current shard it lands in.
- **Exactly one device ever writes any given file** — no ETags, no retry-on-conflict, because there is no race to resolve by construction.
- File layout: `mov-<device>-<YYYY-MM>.json` / `mov-<device>-<YYYY>.json` (yearly compaction) / `act-<device>.json`, all in the `KuroBello` folder; `config-<device>.json` in `appDataFolder`. No `manifest.json` — Drive's own folder listing (`files.list` + `modifiedTime`) is the manifest.
- A closed shard is frozen forever — an edit to an old movement lands its op in the _current_ shard, never reopens the old file. Compaction folds only the closing year's own months, never rewrites an already-closed file, and only deletes the months it just compacted.
- Ops are ordered by a **hybrid logical clock** (physical time + counter + device-id tiebreak), never the raw device clock, so merge results are identical on every device; Drive's server `Date` header clamps a wildly skewed device clock. `Movimiento.fecha`/`createdAt` correctly keep using the device clock — only the op's own ordering metadata must use the HLC.
- A concurrent delete-vs-edit **revives the movement** with a brief on-screen explanation — never a silent data loss.
- No `isSynced` boolean — derive sync status from a **watermark** (last successful push/pull) on the profile record. A profile with no successful-pull watermark shows a full-screen download view (real progress, honest failure+retry) instead of the dashboard.
- Push on reconnect/foreground/write-burst-debounce/`pagehide`, only when dirty; pull on open/reconnect via a `files.list` revision check first. Never write-through on the user's action — a delete disappears locally instantly and is pushed by the same background flush.
- Everything read from Drive is untrusted input: a malformed file/entry or a `config` whose `schemaVersion` isn't exactly the local `SCHEMA_VERSION` — newer **or older** — degrades to "skip and keep going," never a thrown boot, a silent zero, or a downgrade overwriting a correctly-migrated local config; an unrecognized op or newer-version file is ignored and left untouched, never deleted.

**Implementation.** `src/lib/sync/engine.ts` (push/pull/compaction), `src/lib/sync/driveFiles.ts`, `src/lib/sync/opLog.ts`, `src/lib/sync/validate.ts`, `src/lib/hlc.ts`, `src/lib/repo.drive.ts`, `src/lib/sync/status.ts`. `bootstrap` also writes a localized `LEEME.txt` explaining the files in plain language, and yearly compaction writes a flat CSV through the existing export module (§10.12, never a second CSV writer) — both derived/disposable, the JSON stays authoritative. A guest never starts sync triggers.

### 10.20 Signing out, and what a profile belongs to

**Goal.** "Sign out" means what it says, and leftover local data belongs to someone identifiable.

**Rules.**

- Signing out invalidates the cached session inside the PIN vault — not just the in-memory session — so entering the correct PIN afterward never resumes the account just left. The user loses their PIN and sets it again next time; this is accepted, not a bug.
- `ProfileRecord` carries an `accountKey` (not just `kind: 'local' | 'google'`), so two Google accounts on one device resolve to two distinct profiles and signing back in returns the right one.
- Nothing about `Movimiento`/local data is ever deleted as a side effect of signing out — deleting is not the fix for a missing identity field.
- A guest never signs out (no control renders); reopening the app as a guest loads whatever is on the device — recognition of a device, not of a person.
- A confirmation modal appears on sign-out only when unsynced local data exists and Drive is not connected, naming the real count of at-risk movements; the primary action still signs out, keeping them.
- A "delete stored data" control exists but ships visibly inert (a stub) — never the default, never a side effect of signing out.

**Implementation.** `authStore.ts` (invalidate on logout), `src/lib/profiles/profileRegistry.ts` (`accountKey`), profile sheet's sign-out confirm (`useSignOutConfirm.ts`).

### 10.21 Coming back — the returning-user entry screen

**Goal.** A returning user whose Google session lapsed never sees the first-run pitch again — that reads as "everything reset."

**Rules.**

- When the device's login marker is present and the device is online, `restore()` never attempts a silent Google login — it goes straight to `ReturningUserScreen` for an explicit tap. GIS's "silent" `prompt: ''` still opens a visible popup under iOS WebKit's third-party-cookie blocking, which reads as an unrequested login on every refresh; a real tap on this screen is the only thing that ever opens Google's window for a returning device.
- Offline is the one exception: with no network to ask Google anything, a returning device trusts its local cache directly into `authenticated` instead of showing this screen — see §10.11.
- No marker at all (genuine first visit) → `WelcomeScreen`, unchanged. Deliberate sign-out (§10.20) clears the marker → `WelcomeScreen` too.
- One primary action: "continue with Google," greeting the person by name from the profile registry.
- No guest option, no value proposition, no first-run legal copy on this screen by default — that's what "reset" would look like. (§10.37 later carves out a narrow, gated guest escape hatch here — see that section.)
- Any reassurance copy about data being safe must be verifiably true against the local store, not assumed from the marker alone — a browser can evict IndexedDB even though the marker survives.
- This screen must not appear in front of §10.11's offline entry path and block it.

**Implementation.** `src/features/auth/ReturningUserScreen.tsx`, one branch in the boot/`RequireAuth` path.

### 10.22 The category picker — assigning a category, and what a category _is_

**Goal.** A movement's category comes from a two-level sheet, searchable at any depth, and a category is nothing more than a name, an icon, a color and an optional parent.

**Rules.**

- A `Categoria` is `id`/`nombre`/`icono`/`color`/optional `padreId` (the parent's id) — no `tipo`, no section. `Movimiento.categoria` stores the picked id whatever its level; every consumer (display, stats, CSV) resolves and treats a parent and a child identically.
- The collapsed field opens a sheet: level 1 is every top-level category plus a "Custom" tile; a tile with children drills into level 2 (that category itself, general, plus its children); a childless tile selects and closes the sheet.
- Search is flat across both levels and exits any drill-in; the "Custom" tile at either level opens the create modal pre-filled with that level's parent (undefined at level 1). Archived categories never appear at either level or in search; a category whose own parent is archived renders at level 1 (an orphan, not hidden).
- A fresh open always starts at level 1, regardless of where a previous session left off.
- A category referenced by any movement can only be archived, never deleted; the last non-archived category cannot itself be archived, or the picker would have nothing to offer.
- Display resolves through `Config` at render time (a rename never rewrites history); an id that doesn't resolve renders the `tipo` fallback icon/tint and an "unknown category" label, never a raw id or a crash.

**Implementation.** `src/features/tags/CategoryField.tsx`, `CategorySheet.tsx` (§10.22.1 covers `CategoryFormModal.tsx`); `src/components/shared/movimientoView.ts` (resolution/fallback); `src/lib/dataStore.ts` (`upsertCategoria`/`archiveCategoria`/`deleteCategoria`).

**Watch out.** A `Config` write (adding a category) is a single whole-document op under the sync/op-log model — two devices each adding a category offline replay as two whole-config puts, and the later one silently drops the other device's category. Known, unresolved.

### 10.22.1 Creating a category — icon/color suggestion and the form

**Goal.** Typing a category name pre-selects a sensible icon and color, offline, in any of the app's languages, without leaving the sheet.

**Rules.**

- `categorySuggest.ts` matches the typed name against a table of multilingual keyword concepts (whole normalized words only, never a translation API or on-device LLM); a match pre-selects that concept's icon/color as a visible, changeable selection — never applied silently. No match: icon falls back to the movement's `tipo`, color to the least-used tint among the user's existing categories.
- `rankCategoryIcons` reorders the full icon grid so a matched icon leads — it is always a reordering, never a filter; every icon stays reachable.
- The create modal opens with the panel focused, never the name input, so no keyboard rises on open. A parent (`padreId`) is only ever shown, never chosen from within the modal.
- The duplicate-name check is scoped to siblings under the same `padreId` (or top-level, when there is none) — the same name is fine under a different parent.
- `upsertCategoria` returns a boolean; the modal closes only on `true` and guards a double-tap with a `submitting` flag.

**Implementation.** `src/features/tags/CategoryFormModal.tsx`, `categorySuggest.ts`; `src/components/shared/categoryIcons.ts` (`CATEGORY_ICONS` allowlist).

### 10.23 The movement sheet — creating, viewing, editing and deleting

**Goal.** One way to write a `Movimiento`, shared by every entry point, so create and edit can never validate differently from each other. §10.41 is authoritative for the sheet's layout; this entry covers only the non-UI behavior (state ownership, the write contract, parsing).

**Rules.**

- One hook (`useMovimientoForm`) owns all field state, validation and submit; presentational field rendering (`MovimientoFormFields`) is driven entirely by it. Create and edit are separate components (`AddMovimientoSheet`, `MovimientoSheet`) — never a single component branching on a `'create' | 'view' | 'edit'` union.
- The sheet-open store (`movimientoSheetStore`) holds the movement's **id**, never a snapshot of the `Movimiento` object — the sheet re-derives the record from `dataStore` on every render, so an edit or a sync pull elsewhere is never rendered stale. If the movement vanishes while the sheet is open (deleted elsewhere, pulled), the sheet closes and says so — it never renders blank or crashes on `undefined`.
- `createMovimiento`/`updateMovimiento`/`deleteMovimiento` return `Promise<boolean>` (committed or not), never `Promise<void>` — a `Promise<void>` is a success-shaped value for what may be a refused/failed write, and would silently discard what the user typed on a refusal. The sheet consults only this boolean to decide whether to close; it must not call `canWrite` itself (that check belongs solely inside `dataStore`'s `runMutation`).
- `parseAmountForInput(raw, locale)` returns `{ ok: true; value } | { ok: false; reason: 'empty' | 'malformed' | 'not_positive' }` — distinct reasons, since "no value yet" and "an unparsable string" are different user mistakes, and `0` must be rejected (`monto` is always positive per `schema.ts`). The display-only `parseAmount` is built on top of this parser, not duplicated beside it.
- Receipt-scan and voice-entry buttons are never rendered (a control that looks live and isn't is worse than no control); the form exposes a single `applyParsedFields(partial)` entry point as the seam a future voice/scan feature hooks into. `Movimiento.metodo` likewise has no writer anywhere in this UI — a recorded, deliberate gap, not an oversight.
- A `submitting` flag disables Save while a submit is in flight, so double-tap cannot create two movements. Editing a movement's `tipo` flips its displayed sign only — the stored `monto` never goes negative. `moneda` on a new movement always comes from `Config.preferencias.monedaPrincipal`; `id`/`createdAt` are set by `dataStore`; `fecha` is ISO `yyyy-mm-dd`.
- A new movement defaults `fecha` to **today in the device's local calendar day** (`movimientoStats.ts`'s `toIsoDate`, never `Date.toISOString().slice(0, 10)`, which reads the UTC day and is wrong by one day for part of every evening west of UTC) and the date picker (§10.50's `maxDate`) refuses anything later — there is no "pending/scheduled" state for a future-dated movement, so one would silently misstate the current balance.

**Implementation.** `src/features/movimientos/**`: `useMovimientoForm.ts`, `MovimientoFormFields.tsx`, `AddMovimientoSheet.tsx`, `MovimientoSheet.tsx`, `movimientoSheetStore.ts`; the parser lives in `src/lib/i18n/amountFormat.ts`.

**Watch out.** A `"1e999"` amount parses to `Infinity` in JS — the parser's regex must reject it explicitly and a test must pin that, not assume it.

### 10.24 "Personalizar" — the settings screen

**Goal.** The preferences the app already stores become genuinely editable and the category list becomes manageable — no control may write a value nothing reads.

**Rules.**

- `primerDiaSemana`, `idioma` and `monedaPrincipal` each drive a real, immediate effect the moment they change — no dead preference row.
- `idioma?: SupportedLocale` is optional; absent means "follow the device" — a stored value always wins over `detectLocale()`, but changing it never touches `detectRegion()` (copy language and formatting region are independent axes, §10.7).
- No theme control ships until the light palette exists (§10.30) — offering `claro`/`sistema` against an unreviewed palette would visibly lie the moment it's tapped.
- Categories: tapping one opens `CategoryFormModal` (§10.22) in edit mode — reuse it, never a second editor. A category referenced by any movement can only be archived, never deleted; archived categories collapse into an "Archivadas" group, never hidden outright.
- `dataStore.updateConfig` merges the changed field into the freshest config, never a blind `set({ config: result })` that could clobber a concurrent write.
- Choosing "seguir el dispositivo" writes `idioma` back to `undefined`, and the next boot must resolve to the detected locale.
- Archiving the last non-archived category is refused; deleting a category still referenced by a movement is refused, offering the archive path instead.
- `LockScreen`/`LockSettings`/`errorCopy.ts` route all copy through a `lock` i18n namespace (mirroring `src/features/auth/errorCopy.ts`'s key-returning pattern) — no hardcoded Spanish remains there.

**Implementation.** `src/features/settings/**` (route `/settings`); entry point is the Profile sheet's `PreferencesSection` rows. No `SCHEMA_VERSION` bump — `idioma` is additive.

**Watch out.** Number-format overrides (separators, decimals) are deliberately not built — `Intl` already derives them from the locale (§10.7); a manual override would be a second, contradictable source of truth.

### 10.25 The `repoProvider` flip — turning the real data on

**Goal.** `getRepo()` returns the profile-scoped real local repo instead of `repo.fake.ts`; the seeded demo data is gone.

**Rules.**

- The flip is gated on a create-UI existing (the movement sheet) — flipping to a real, empty repo with no way to add anything is a regression, not a milestone.
- The flip must ship together with an honest empty state — a real user seeing zero movements must not read as "it deleted everything."
- The active profile is resolved once at boot and handed out as the bound repo (rather than making `getRepo()` async and re-resolved per call), matching how `dataStore.load()` already gates the screens — a per-call async resolution risks different call sites landing on different profiles if the active one changes mid-sequence.
- The outbox must be redirected to the profile-scoped database in the same change — an outbox still pointing at a single default database queues one profile's pending ops into another's.
- Seed taxonomy localization keys off the active i18next language, not device region — region already owns `monedaPrincipal` because money is about where you are, category names are about what language you read, and the two axes are independent (§10.7).

**Implementation.** `src/lib/repoProvider.ts`, `src/lib/boot.ts`, `src/lib/outbox.ts`, `src/lib/seedConfig.ts`.

### 10.26 Sync goes live — wiring the engine into the running app

**Goal.** A signed-in user's movements reach their own Drive and come back on another device, without the user thinking about it.

**Rules.**

- `push()` must be serialized against itself (refuse or coalesce a concurrent call) — an unserialized read-modify-write on a Drive shard can silently drop an operation that a second overlapping push's stale read never saw, breaking §10.19's "exactly one writer" invariant in practice even though it holds by design.
- Sync triggers take a **getter** for the token and active profile, never a captured value — the token refreshes and the profile changes on sign-in/out.
- Triggers start only with a Drive-scoped session and an active profile (never for a guest, never unconditionally at import), and stop on sign-out, losing Drive scope, or lock — something in production must own the returned stop handle.
- A dirty outbox debounces into a push after `PUSH_DEBOUNCE_MS` (6s) of quiet, not on every write — a burst of edits coalesces into one push.
- A genuinely fresh session (no successful-pull watermark) shows the full-screen download view with real progress and an honest failure+retry, never a dashboard of zeros; a returning user with local data pulls in the background instead.
- The Drive status row (syncing/up to date/pending) reads from `sync/status.ts`.
- A revived movement (§10.19's delete-vs-edit conflict) gets a one-line Toast explanation, not a screen.
- A malformed skipped entry is counted and surfaced through the pull summary, not just a `console.warn`.

**Implementation.** `src/lib/sync/**`, hook points in `authStore.ts`, `main.tsx`, the Drive status row in `SyncSection.tsx`.

**Watch out.** Locked mid-sync: the in-flight push must complete or stop cleanly, never drain the outbox after the session it belonged to is gone. Token expiring mid-pull: reacquire and continue per §10.11, not a user-facing failure.

### 10.27 One currency at a time, honestly

**Goal.** A total is never the sum of two different currencies, once `monedaPrincipal` became user-editable after movements already existed in another currency.

**Rules.**

- Aggregate functions (`totals`, `breakdownBy`, `series` in `movimientoStats.ts`) take the currency to aggregate as a **required** argument — never a default parameter, since a default recreates the exact silent-mixing bug at any call site that forgets to pass one.
- Home/History display the `monedaPrincipal` total only, grouped by currency, never mixed.
- When movements exist in a currency other than the principal one, the screen says so in a short line — never a modal, never a second competing total, and never a silent exclusion (excluding them is the same dishonesty as summing them in).
- `Movimiento.moneda` itself, its values, and its region-derived default are untouched by this — this is an aggregation fix, not a schema change.
- Money sums accumulate in integer minor units (cents), converting once on the way out — summing floating-point `monto` directly drifts (`0.1 + 0.2 !== 0.3`).

**Implementation.** `src/lib/movimientoStats.ts` (`totals(movimientos, moneda)`, `otherCurrencies(movimientos, moneda)`, `toMinorUnits`/`fromMinorUnits`), consumed by `useHomeDashboard.ts`, `HistoryScreen.tsx`, `homeView.ts`.

**Watch out.** CSV export already writes each row's own `moneda` per movement and needs no change here — verify, don't assume, if this file is ever touched again.

### 10.28 The boot sequence — resolving the profile before anything renders

**Goal.** The app knows whose data it is showing before it shows anything.

**Rules.**

- Order: lock first (a locked app resolves nothing underneath the lock screen) → resolve the active profile, open its database, touch `lastUsed` → `dataStore.load()` (one `Promise.all` for all three collections) → render.
- A caller asking for the repo before the binding exists must throw loudly in development — never silently fall back to the fake repo, which would write real money into a store that evaporates.
- Sign-out-then-sign-in-as-a-different-account must fully rebind the profile/repo/outbox — a binding resolved once at boot and never invalidated is the bug this design must avoid.
- IndexedDB unavailable (private mode, denied storage, exhausted quota) is an honest error via the existing offline taxonomy, never a white screen.
- The sequence must be idempotent under React `StrictMode` double-invoke and back-to-back calls, the same way `dataStore.load()`/`authStore.restore()` already are.
- A `schema_mismatch` failure (local data older than `SCHEMA_VERSION`, no migration registered) offers a destructive, confirmed recovery action that deletes the active profile's own IndexedDB database and reloads — the only in-app way off an otherwise permanent boot loop. Scoped to that one database: never `kurobello-device`, never Drive.

**Implementation.** `src/lib/boot.ts`, `src/main.tsx`, `src/lib/repoProvider.ts`. The recovery action: `src/lib/bootRecovery.ts`, `src/features/boot/BootErrorScreen.tsx`.

**Watch out.** There is no full-screen boot screen — §10.29 has the loading treatment (a sync pill plus the app's own skeleton). The sequence above (lock → resolve → bind → load → render) is unaffected by what covers it visually.

### 10.29 One loading moment, not two

**Goal.** A cold open never shows two different full-screen loading treatments back to back before Home.

**Rules.**

- There is no full-screen loading/boot screen at all — the design has no splash/boot artboard. A sync-status pill in the top bar is the only "we are busy" signal, and it never covers the screen.
- A returning user must never see the Welcome/login screen flash while auth `restore()` resolves — the pre-content span renders the real app shell with the Home skeleton (§10.9 Tier 2), not a distinct loading screen.
- The skeleton renders only when `deviceStore.hasLoggedInBefore()` says a session has existed on this device before; a device that never signed in goes straight to Welcome, promising nothing.
- A returning, online user always lands on `ReturningUserScreen` rather than Home once the skeleton resolves — `restore()` no longer attempts a silent Google login (§10.21), only an explicit tap does.
- A genuinely fresh sign-in's first-time Drive download view (§10.26) may still follow, seamlessly — no flash of Home, no gap, no extra spinner.

**Implementation.** `RequireAuth.tsx` composes `PreContentSkeleton` (`src/features/boot/`) directly; there is no separate boot-gate screen.

### 10.30 The light theme, and the picker it unblocks

**Goal.** Light becomes a real, contrast-correct theme so the picker §10.24 withheld can ship honestly.

**Rules.**

- The `chart-*` tint tokens (13, extended past the design export's original five) differ between themes — a category tint must clear WCAG's 3.0 graphical-element threshold on its own surface in both themes, by holding hue/saturation and lowering lightness for light rather than reusing dark's values.
- The four danger/warning tokens get the same dark→light relationship as the design's own danger pair.
- `--muted`/`--accent`/`--secondary` correctly collapse to the same white as `--card` in light — surfaces separate by shadow/border, not fill; this is intended, not a translation error.
- The theme resolves synchronously at first paint via a tiny inline script in `index.html` reading a stored preference — `Config` from IndexedDB resolves too late to avoid a full-screen color-inversion flash.
- The app keeps its `.dark`-class convention (Tailwind's `dark:` variant already targets it everywhere) rather than an attribute-based toggle.
- `sistema` follows `prefers-color-scheme` live — changing the phone's theme mid-session must not need a reload.

**Implementation.** `src/lib/theme.ts` (+ its inline boot script in `index.html`), `:root`/`.dark` in `src/styles/index.css`. `Preferencias.tema` already exists — no schema change.

**Watch out.** The theme preference is deliberately the one thing this app puts in `localStorage` (`kurobello-theme`) despite the ban on it for sensitive data — a theme choice isn't sensitive, and it must be readable before React/IndexedDB exist.

### 10.31 Choosing a profile — the switcher, whose database is whose, and the PIN gate

**Goal.** A person can move between the profiles on their device deliberately, and can tell whose data each one holds.

**Rules.**

- The active profile is an **explicit pointer** in the device registry, not inferred from recency — recency stays only as the fallback for a device that has never made an explicit choice.
- Each profile database gets its own owner marker (account key, kind, created-at) written inside the database itself, so a database can identify itself even if the registry is lost or corrupted.
- The local (no-account) profile's label must say "this device's own" rather than the hardcoded, unlocalized `'Local'`.
- **No PIN prompt on switching profiles** — the PIN gates opening the app, not moving inside it, once past the lock. This is a deliberate, accepted widening of an existing exposure (unlocked-phone access to every profile), not a new class of risk, since local data is already unencrypted at rest for anyone.
- Unlocking must never rehydrate a session belonging to a _different_ profile than the one the vault's cached session was created for — a switch's PIN gate is authorization only, never a session restore across profiles.
- Switching reuses `boot.ts`'s rebind path (resolve, bind repo, redirect outbox, reset the data store, then load) — it does not grow a second rebind mechanism.
- Sync triggers stop for the old profile and start for the new one only if that profile's account has a live Drive session — switching to a Google profile you're not currently signed into shows its local data with sync explicitly off, never a silently-stuck pill.
- A push in flight during a switch must be threaded through a profile-scoped database reference, not the outbox's stale module-level binding — otherwise a mid-flight redirect drains the wrong profile's outbox.
- Every local write's `runMutation` captures its target database synchronously, before `write()` runs, and threads that captured value explicitly into `enqueueOperation` — never the implicit module-level fallback. A switch racing a write can then never enqueue the write into the profile that became active after it started. `outbox.ts`'s dirty flag tracks "did this write land in the currently-bound table," by reference, not "was no database argument passed" — the latter breaks once a caller can legitimately pass the active profile's database explicitly.

**Implementation.** `src/lib/profiles/profileRegistry.ts` (explicit `activeProfileId` via `getActiveProfileId`/`setActiveProfileId`), `src/lib/profiles/profileOwner.ts` (owner marker), `src/lib/profiles/switchProfile.ts`, `src/features/profile/ProfilesSection.tsx`, `src/lib/dataStore.ts` (`runMutation`), `src/lib/outbox.ts`.

**Watch out.** Two tabs on the same device with two different profiles is out of scope by design (the registry is device-wide) — do not invent cross-tab coordination for it.

### 10.32 Bringing guest data into a profile — the prompt, the persistent entry, and why adoption is a copy

**Goal.** Signing in with Google after using the app as a guest never looks like the app forgot the person's data, and bringing guest movements over stays available for as long as there's something to bring, not just once at login.

**Rules.**

- A guest with local data who signs in is **offered once**, at login, whether to bring their movements into the new profile — never migrated automatically, because bringing data into a Google profile means uploading it to that person's Drive, and guest mode may have been chosen precisely to avoid that. The prompt cannot be dismissed by a backdrop tap or Escape — only its own two buttons resolve it, since an accidental dismissal here reads as data loss.
- Adoption is a **copy, never a move**: `adoptGuestMovements` only ever `bulkPut`s into the target profile — the guest profile keeps every movement it had, unchanged, indefinitely.
- The login prompt is a one-time discoverability nudge, not the only way in. A **persistent entry on the Profile screen** (`GuestAdoptionSection`) is visible any time the active profile is Google-authenticated and has at least one guest movement not yet copied into it — including after declining the login prompt, losing it to an app close mid-decision, or adding more guest movements after an earlier adoption. Re-invoking it is safe with nothing left to copy (hides itself at zero) and copies the outstanding delta.
- Adopting refreshes `dataStore` immediately (`reset()` + `load()`) — the copy bypasses `runMutation`'s optimistic `set()`, so without an explicit refresh the newly-copied movements would only appear after an unrelated reload.
- Copy wording says **profile**, not account, throughout — the app already lists Google/local profiles by that name in the switcher (§10.31), so guest-data copy stays consistent with it rather than switching terms mid-flow.
- An interrupted adoption is resumable — repeated calls only enqueue what a device-local marker (`deviceStore.ts`'s `adoptedMovements`) hasn't already recorded as delivered, marked only after a successful enqueue, never after the `bulkPut` alone. This is what keeps a second adoption from re-enqueuing and over-reporting movements whose outbox rows were already compacted away by a prior successful push.
- The emptied guest profile is never deleted — it is the default local profile and always exists.

**Implementation.** `src/lib/profiles/adoption.ts` (`adoptGuestMovements`, `countUnadoptedGuestMovements`), `src/lib/deviceStore.ts` (persisted `adoptionConsent`/`adoptionDeclined`/`adoptedMovements`), `src/lib/boot.ts` (silent resume hook), `src/features/auth/GuestAdoptionPrompt.tsx`, `src/features/profile/GuestAdoptionSection.tsx` + `useGuestAdoptionEntry.ts` (the persistent entry, composed into `ProfileSheet.tsx` per §10.18).

### 10.33 A guest who comes back — persisting guest mode, and what the guest lock actually protects

**Goal.** A returning guest reaches their own local data on cold start, the same way a returning account holder does — and the guest lock's copy describes what it actually does.

**Rules.**

- Guest mode is a persisted device-local signal (in `deviceStore.ts`), not in-memory-only — otherwise the guest biometric lock (§10.2.1) can only ever re-lock a session already running, never gate a cold start, while its copy claims it does.
- The guest marker is cleared the moment the guest leaves: signing in with Google, or an explicit exit from the profile screen. A stale marker must never survive past that choice.
- On a device with both a Google login marker and a guest marker, the account marker wins the _attempt_ on cold restart (silent re-auth is retried first) — this is accepted, not a bug: nobody is stranded, the guest data stays reachable through the switcher (§10.31), the cost is re-tapping guest once per cold boot.
- Persisting guest mode does **not** change what the guest lock protects — it is still a UI gate, never a cryptographic boundary, because the local database is unencrypted at rest for everyone. Do not read this as license to start encrypting local data.
- If biometric capability is lost after the guest lock was enabled (sensor disabled, credential revoked by the OS), degrade to unlocked and say the lock is off — never a dead end, since there is no honest recovery path for a guest.

**Implementation.** `src/lib/deviceStore.ts` (`markGuestUsed`/`hasUsedGuestBefore`), `authStore.ts` (set on entering guest, cleared on sign-in/exit, restored in `restore()`), `src/lib/lockStore.ts` + `src/features/lock/**` (cold-start guest gate).

### 10.34 The shell standard — zoom, welcome-screen scroll, top-inset token

**Goal.** One shared standard for the shell's zoom behavior and top spacing, so screens can't drift to different top margins again.

**Rules.**

- Pinch-zoom and double-tap-zoom are switched off via `index.html`'s viewport meta (`maximum-scale=1.0, user-scalable=no`) plus `touch-action: manipulation` on `html` — see §10.34.1/§10.34.2 for what this actually achieves per platform.
- Every top-level screen without its own header pads with `pt-(--screen-inset-top)`: `max(calc(1.5rem - env(safe-area-inset-top)), 0rem)` — a floor topping up whatever safe-area inset `body` already contributes, never double-counting it.
- A screen with a back-bar header renders `ScreenHeader` (`title`, `onBack`, `backLabel`, optional `subtitle`) as the first element inside that padded container, owning its own height, instead of encoding "floor + header" as a second magic number. `HistoryScreen`'s chevrons+year-menu header stays bespoke — it isn't a back-button row.
- A root that must fill real height uses `min-h-full` (resolves against the `html`/`body`/`#root` chain, all `height: 100%`), never `min-h-dvh`, while sitting in normal in-flow inside `body` — `body`'s own safe-area padding plus a raw-viewport `min-height` demand overflows the page by exactly the inset amount. Enforced by `scripts/no-in-flow-min-h-dvh.sh` (`bun run check`), which flags any in-flow `min-h-dvh` not paired with `fixed` on the same line.
- `FullScreenPanel.tsx` (a `fixed`, portaled shell) is the one legitimate `min-h-dvh` — `fixed` positioning, not "portaled" in general, is the actual exemption criterion.

**Implementation.** `src/styles/index.css` (`--screen-inset-top`), `src/components/shared/ScreenHeader.tsx`. Pinned by `src/styles/screenChrome.test.ts` as a source-text check only — it cannot prove the token resolves to the right pixel value in a real browser, only that no screen quietly reverts to a hardcoded `pt-*`.

**Watch out.** `FullScreenPanel.tsx`'s own header/body padding use a separate, differently-shaped safe-top pair, `--overlay-inset-top`/`--overlay-inset-bottom` (a bare `max(1.5rem, env(...))`) — correct there, since a `fixed` panel gets none of `body`'s ambient padding for free and must add the inset itself rather than topping one up.

### 10.34.1 The zoom rule does not hold uniformly across platforms

**Goal.** The zoom-off attributes stay unified at the markup level even though their real effect differs per platform.

**Rules.**

- `user-scalable=no`/`maximum-scale=1.0` is honored by Android Chrome (pinch-zoom off) but ignored by iOS Safari since iOS 10, as a WebKit accessibility override authors cannot opt out of — pinch-zoom stays available on a real iPhone regardless of this markup. iOS keeping pinch-zoom available despite it is accepted, not something to work around.
- `touch-action: manipulation` (double-tap-to-zoom off) is honored on both platforms.
- The attributes stay in `index.html` even though iOS ignores half of them — they still suppress pinch-zoom on Android, and there is no way to defeat iOS's override without intercepting gesture events, which the app's Pointer-Events/accessibility posture rules out.
- The lost zoom-as-accessibility-fallback trade-off is justified because the type scale is `rem`-based throughout and already honors the system font size — no component sizes text in raw `px`.

**Implementation.** `index.html`'s viewport meta; `touch-action: manipulation` on `html` in `src/styles/index.css`.

**Implementation.** Same files as §10.34.1; this entry is the decision, the previous one is the fact it rests on.

### 10.35 BottomSheet grab handle — fixed chrome, not scrolling content

**Goal.** A sheet's drag handle stays fixed chrome; only the body scrolls, matching a native sheet.

**Rules.**

- The panel is a `flex flex-col` shell of exactly two children: the drag handle (`shrink-0`, owns the pointer-drag logic) and a `flex-1 min-h-0 overflow-y-auto` body that owns the horizontal/bottom padding — scrolling long content never carries the handle away with it.
- `max-h-[88dvh]` stays on the outer panel as the static fallback; short content still sizes to fit without engaging scroll.
- `className` merges onto the outer panel only, the same contract as `CenterModal` — it never targets the padded/scrollable body.
- The scrollable body carries `overscroll-y-contain` — without it, a drag past the body's own scroll boundary chains into rubber-banding the scroll-locked page behind it on iOS.
- A CSS transform on the flex container (the drag) never touches a scrolling descendant's own scroll state — dragging mid-scroll and scrolling mid-drag don't corrupt each other.
- The backdrop closes the overlay only when the gesture's own `pointerdown` landed on it (`useBackdropDismiss`, shared with `CenterModal`). A `click` is a fresh hit-test against the DOM as it stands when it fires, not a replay of the `pointerdown` target: content shrinking under a finger — the amount pad collapsing (§10.54) — otherwise slides the backdrop beneath a tap that began inside the sheet and dismisses it.

**Implementation.** `src/components/shared/BottomSheet.tsx`. The identical fixed-chrome/scrolling-body split exists in `FullScreenPanel.tsx` (§10.35.1).

### 10.35.1 FullScreenPanel's identical shape, plus the same overscroll gap

**Goal.** Give `FullScreenPanel` (used by `LockSettings`/`PinSetup`) the same fixed-chrome/scrolling-body split `BottomSheet` has.

**Rules.**

- `FullScreenPanel` takes an optional `header` prop: fixed chrome (`shrink-0`) as a sibling of a `min-h-0 flex-1 overflow-y-auto` body, carrying the caller's back-button/title row — unlike `BottomSheet`'s handle, this header is consumer content, so it needs a real prop rather than being baked into the shell.
- The top safe-area inset lives on `header` (falling back onto the body with no `header`, so a headerless consumer isn't silently left uninsetted); the bottom inset stays on the body, mirroring `BottomSheet`'s `pb-7`.
- Both shells' scrollable bodies carry `overscroll-y-contain`.

**Implementation.** `src/features/lock/FullScreenPanel.tsx`; both consumers (`LockSettings.tsx`, `PinSetup.tsx`) pass their header row via `header=`.

### 10.36 The returning-user screen's second action — guest, behind a gate

**Goal.** `ReturningUserScreen` gives someone who does not want to sign in again a real way out, without turning back into a first-run pitch.

**Rules.**

- A secondary, visually distinct "Continuar como invitado" button opens a confirm dialog before calling `continueAsGuest()` — a materially different object from re-showing the welcome pitch, as long as the dialog stays a one-sentence warning about the consequence and never grows a value proposition or legal copy.
- The dialog's copy must be exactly what happens, no more: this is a separate, device-only profile; the Google account's data is untouched; the way back is the profile switcher (§10.31) — never a false claim like "your data will be deleted."
- Confirming calls `continueAsGuest()` once; cancelling calls it never.
- Nobody is left stranded by this: within the same session the profile switcher (§10.31) already lists the lapsed Google profile and lets the user tap back to it with no PIN; across a cold restart, the login marker takes precedence on retry (§10.33), so guest is always one tap away again, never a dead end.
- Where two actions on a screen would call the identical underlying function with identical arguments, that is one control duplicated under two labels, not two actions — the primary and this gated guest path must stay genuinely distinct calls.

**Implementation.** `src/features/auth/ReturningUserScreen.tsx` (second button + `ConfirmDialog`), `auth.return.guestConfirm.*` i18n keys across all four locales.

### 10.38 "Olvidé mi PIN" copy — what resetting the vault actually does

**Goal.** The forgot-PIN confirmation dialog must say only things that are true.

**Rules.**

- Resetting the vault (`lockStore.reset()` → `pinLock.resetVault()` + `authStore.logout()`) deletes exactly the vault row plus two device-wide markers — it never touches `movimientos`/`activos`/`config`/`outbox`, which live on the same per-profile connection but are separate tables.
- The local financial cache is not encrypted at rest for anyone (§10.2) — only the cached OAuth token inside the vault ever is. Copy must not imply the reverse.
- Signing in again with Google resolves back to the exact same profile by `accountKey` — resetting the vault does not remove the path back to the data, it only changes which cold-start screen renders first (`WelcomeScreen` instead of `ReturningUserScreen`).
- The confirm button and copy must match the verb used elsewhere for the same real-world outcome ("Cerrar sesión," not "Borrar y salir") — resetting the PIN is a sign-out, not a deletion.
- Turning the PIN off from `LockSettings` runs this identical `reset()` path (vault wipe + forced sign-out) — it is not a quiet preference flip, and any copy describing it must say so.

**Implementation.** `src/features/lock/LockScreen.tsx`, `src/lib/lockStore.ts`, `src/lib/pinLock.ts`; i18n across all four locales.

### 10.39 The min-h-dvh sweep

**Goal.** One owner, one fix, for every screen sharing the `min-h-dvh`-inside-padded-`body` scroll bug.

**Rules.**

- Any plain in-flow root using `min-h-dvh` (not `fixed`) sits inside `body`'s own safe-area-padded content box, so it demands more room than that box has and forces the whole page to scroll by exactly the inset amount on a device with a real notch/home-indicator — invisible in a desktop browser or DevTools emulation (zero inset there).
- The fix is `min-h-dvh` → `min-h-full` everywhere the bug applies — `min-h-full` resolves against the `html`/`body`/`#root` chain and can never demand more than `body`'s own padded content box actually gives.
- The one legitimate exemption is `fixed` positioning, not "portaled" in general — a portaled-but-not-`fixed` element still lands inside `body`'s padded flow and carries the identical bug.
- The guard (`scripts/no-in-flow-min-h-dvh.sh`, in `bun run check`) scans the whole tree for a bare `min-h-dvh` not paired with `fixed` on the same line — a line-based grep, not a parser, so a `className` wrapping those two across separate lines would slip past it.
- `html` itself is `height: 100svh`, not `100%`/`100dvh` — `body`/`#root` stay `height: 100%` (of that). `svh` resolves to the real visible viewport on load on iOS WebKit, where a bare `100%`/`vh` root resolves against the browser-chrome-collapsed viewport and leaves a few pixels of empty, harmless-but-real scroll on every screen until the page is touched once. `dvh` was rejected here too: WebKit shrinks it on the first keyboard open and never recovers it for the rest of the session (§10.2's `inputMode="none"` area, and the `dvh`-in-PWA limitation in the backlog) — `svh` is fixed from the start, so it never has that failure mode.

**Implementation.** The swap applies to `AppShell.tsx`, `AppErrorBoundary.tsx`, `RouteErrorFallback.tsx`, `boot/BootErrorScreen.tsx`, `auth/DrivePermissionScreen.tsx`, `auth/ReturningUserScreen.tsx`, `lock/LockScreen.tsx` (both branches), `sync/DriveDownloadScreen.tsx`, `components/shared/ScreenLoading.tsx`, and `boot/PreContentSkeleton.tsx` (the last moved to `h-full`, §10.43, since its geometry mirrors `AppShell`'s) — any new file reintroducing the shape is caught by the guard.

### 10.40 ConfirmDialog's confirm button

**Goal.** The confirm button paints the actual stakes of the action, not a hardcoded "delete" red.

**Rules.**

- `destructive: boolean` is required on every `ConfirmDialog` caller, with no default either direction — a defaulted `true` leaves every future harmless dialog wrong until overridden; a defaulted `false` lets a future genuine delete silently ship looking safe, strictly worse in a money app. Required turns "the caller forgot" into a compile error.
- `destructive` maps directly to `Button`'s `variant` (`destructive` when true, `default` when false); Cancel always stays `secondary`.
- Classify by the mutation actually performed, never by the row's own label — e.g. deleting an already-archived category is destructive even though its own row calls the action "archive."
- The gone-profile dialog (registry-row removal only; the underlying database is already lost) and sign-out/guest-switch (fully reversible) are not destructive; movement/category deletion is.

**Implementation.** `src/components/shared/ConfirmDialog.tsx`; generates its own `labelledBy` via `useId()`, takes all copy as props, adds no locale keys of its own.

### 10.41 The Add/Edit sheet — layout

**Goal.** The create and edit sheets match the design export's actual layout, which the original §10.23 prose UI had never been diffed against.

**Rules.**

- Field order (both sheets, via `MovimientoFormFields`): type toggle → centered date chip (no "Fecha" label) → centered amount display → category field → note field ("Descripción", `maxLength=40`) behind a collapsed-by-default "ver más ⇄ ver menos" disclosure.
- The amount display is a new component, `MovimientoAmountInput` — borderless, auto-sizing (`field-sizing: content`), a decorative currency symbol beside it, digits colored by `tipo` (income = success color, expense = plain foreground). It is not built on the shared `AmountField` (since deleted, see §10.48) — it reuses only `parseAmountForInput`/`formatAmountForInput` directly.
- The create sheet has no visible heading (the sheet's own grab handle is the header) and no Cancel button — dismissal is backdrop-tap/Escape/drag-to-dismiss only; the primary button (labeled "Agregar gasto"/"Agregar ingreso", following the type toggle — never a generic "Save") takes the full action row.
- Edit mode keeps its own Cancel + Save row (Cancel returns to view mode without writing — a distinct affordance from dismissing the whole sheet) and keeps the generic "Guardar"/"Save" label, since edit's type toggle changes an existing movement rather than naming what gets created.
- The category field (`CategoryField`) is a single collapsed row — icon swatch, picked name or a placeholder, chevron — that opens `CategorySheet` (§10.22) on tap.
- View mode's icon block starts flush with no extra top padding, matching every other sheet.

**Implementation.** `src/features/movimientos/MovimientoAmountInput.tsx`, `MovimientoFormFields.tsx`, `AddMovimientoSheet.tsx`, `MovimientoSheet.tsx`; `src/features/tags/CategoryField.tsx`, `CategorySheet.tsx`.

**Watch out.** `field-sizing: content` combined with an explicit Tailwind width utility (e.g. `w-40`) pins the box at that width in a supporting browser — it does **not** gracefully fall back the way blog posts imply. The correct pattern is `@supports`-gated: keep `w-40` as the fallback and add `supports-[field-sizing:content]:w-auto` so a supporting browser's own `@supports` evaluation hands width back to content-sizing. Confirmed in Chrome; Firefox has no `field-sizing` support, unconfirmed there.

### 10.42 A transient owner-marker read failure must not read as "this profile's data is gone"

**Goal.** A storage read failure while checking a profile's owner marker must never be treated the same as a genuinely absent marker — one is transient, the other triggers an irreversible registry deletion.

**Rules.**

- `readOwnerMarker` must propagate a storage failure rather than resolving it to `undefined` — `undefined` must mean only "genuinely absent," never "the read threw."
- On a thrown read, `switchProfile.ts` reports a distinct outcome (`'switch-check-failed'`), never `'profile-database-gone'` — the latter is reachable only from a marker confirmed genuinely absent.
- `'switch-check-failed'` routes to an ordinary "try again" toast, never the destructive gone-profile removal dialog (which deletes the registry's only pointer to that profile's database, with no `indexedDB.databases()` enumeration anywhere in the app to rebuild it).
- A write-path self-catch (e.g. `ensureOwnerMarker`) is fine where the caller never treats the degraded value as a decision input and a future write idempotently retries — the distinguishing question for every read is always "what does the caller do with the degraded value," never "what does the rest of the file do."

**Implementation.** `src/lib/profiles/profileOwner.ts` (`readOwnerMarker`, no longer self-catching), `src/lib/profiles/switchProfile.ts` (`SwitchProfileResult` outcomes), `src/features/profile/useProfiles.ts` (`removeGoneProfile` reachable only from a confirmed-absent marker).

**Watch out.** This is the same shape (a failure silently degraded to a success-shaped value) as fixes already made in `switchToProfile()`/`countGuestMovements()` — when auditing a module for this pattern, check what each individual caller does with the degraded value; "this file already handles it the same way elsewhere" is not sufficient justification for a swallow.

### 10.43 AppShell's root: h-full

**Goal.** `AppShell`'s middle pane is actually the app's one scroll container, not just visually resembling one.

**Rules.**

- The root is `h-full` (a definite value), not `min-h-full` (a floor) — with only a floor, the `flex-1` middle pane got a content-driven height, so a leaf-route error/short screen collapsed to content size, and any screen with more than one viewport of content scrolled the whole document (masked only because `BottomNav`'s `fixed` positioning always tracks the true viewport regardless of what scrolls).
- With `h-full`, the pane's own `scrollHeight`/`clientHeight` genuinely diverge under long content, document `scrollHeight` stays pinned to one viewport, and `pane.scrollTop` moves independently of `window.scrollY`.
- The pane carries `overscroll-y-contain`, matching `BottomSheet`/`FullScreenPanel`'s precedent, now that it's a genuine scroll-container.
- `h-full` doesn't touch `body`'s own padding or `--bottom-nav-clearance`/`--screen-inset-top` — only how the root's own height is specified.

**Implementation.** `src/routes/AppShell.tsx`. `Home`/`HistoryScreen`/`SearchScreen` keep their own `min-h-full` roots inside this now-definite pane, unaffected — their content is normally taller than the pane already. `boot/PreContentSkeleton.tsx` mirrors the identical `h-full` + `overscroll-y-contain` shape (§10.39) since it deliberately mirrors `AppShell`'s geometry for the pre-content span.

### 10.45 The amount display centers on its own and groups live as you type

**Goal.** The amount's digits stay visually centered regardless of the (locale-dependent-width) currency symbol beside them, and the number groups live as the user types instead of showing raw ungrouped digits.

**Rules.**

- The digits — not the `[symbol, digits]` pair — are centered. Implemented as a symmetric flex row: real symbol · input · an invisible `aria-hidden` mirror of the same symbol, all under one `justify-center gap-2` — this keeps the input's midpoint pinned to the row's midpoint regardless of the symbol's own rendered width (e.g. "R$" vs "$" vs "S/"), with no percentage/pixel math to keep in sync as the input resizes on every keystroke.
- The row must have `w-full`: it sits inside a `flex-col items-center` parent, which leaves it shrink-to-fit unless given an explicit width — without `w-full`, `max-w-[calc(100%-3rem)]` on the input resolves against the row's own unbounded content width and does nothing, and a wide symbol (a 3-letter ISO code like `PEN`, which some locales render instead of a true symbol) can push the whole row past the sheet's edge.
- Do not center via CSS Grid `1fr auto 1fr` — an auto-sized grid track's percentage `max-width` is indefinite during track sizing, so a long number can size the track past the container before the percentage ever constrains it.
- `formatAmountLive(raw, locale)` strips the locale's own group separators from the integer part and re-inserts them via `Intl.NumberFormat(locale).format(BigInt(integerDigits))` — never a hand-rolled separator table. The fraction is left exactly as typed (never round-tripped through `Number()`), so a trailing decimal separator (`"1,"`) or a trailing fraction zero (`"1,50"`) survives mid-entry.
- `formatAmountLive` reformats only input that already has the shape of a number in progress (digits, the locale's group/decimal separators, an optional leading sign, at most one decimal separator); anything else — real garbage like `"abc"` or a paste like `"$100"` — passes through completely unchanged, so it still reaches `parseAmountForInput` and still resolves to the `malformed` reason. A string that is entirely group-separator noise with zero digits (e.g. a lone `"."` in `es-CO`) must not collapse to `""` and read as `empty` — it is treated as separator noise and passed through unchanged, same as any other non-number-shaped input.
- Caret-preservation logic that reformats a controlled input's value must not be a `useLayoutEffect` keyed on the `value` prop: if the reformatted string is identical to the current one (backspacing over a derived separator regenerates the same string), React sees an `Object.is`-equal value and bails out of the re-render _and every effect that would have run with it_ — yet the DOM's own controlled-input value-forcing still runs, with no caret placement. The reformat + `el.value =` + `el.setSelectionRange(...)` must happen synchronously inside the native `onChange` handler itself, before calling the prop's `onChange`, so it works whether or not React re-renders.
- Re-formatting a value prefilled from `formatAmountForInput` through `formatAmountLive` must round-trip byte-for-byte identical, for amounts with up to 2 typed fraction digits (the domain `formatAmountForInput` itself targets). Beyond that domain the two are not claimed equivalent.

**Implementation.** `src/lib/i18n/amountFormat.ts` (`formatAmountLive`, `digitsBeforeIndex`, `indexAfterDigitCount`, `isAmountInputInvalid`); `src/features/movimientos/MovimientoAmountInput.tsx` (the row/centering/caret logic).

**Watch out.** IME composition is unverified risk: the caret-rewrite `onChange` handler doesn't check `event.nativeEvent.isComposing`, and rewriting `.value`/selection while a real IME owns an active composition range is documented-risky on real devices. Needs verification on a real Android IME keyboard.

### 10.46 The `+` FAB raises the keyboard; the primary CTA is export-sized

**Goal.** Tapping the FAB to add a movement should raise the software keyboard immediately, and the sheet's commit button should match the design export's size rather than the generic touch-target button size.

**Rules.**

- An overlay's initial-focus effect must call `.focus()` synchronously within the same commit as the triggering click (a `useLayoutEffect`, no `requestAnimationFrame`/passive-`useEffect` hop) — iOS Safari only raises the software keyboard for a `.focus()` still inside the task that carries user activation; a focus call one frame later attaches focus with no keyboard.
- This governs every `initialFocus` consumer, not just the Add sheet: PIN entry, the category-create name field, and the `/kit` demo all get the same synchronous-focus behavior — treat it as a property of the overlay system, not a special case for one sheet.
- The primary commit button (Add sheet's single CTA, and the edit sheet's Save) renders at 54px height / 18px radius / 15px (`--text-md`) / weight 800 — sized per the design export, not `Button size="touch"`'s 44px/12px/500 touch-target minimum. Apply as a per-call-site class override (exactly two call sites), not a new shared `button.tsx` size variant.
- Edit mode's Cancel button (same row as Save) takes only the height/radius half of that override, never the font-weight half — a two-explicit-height-button row needs matching heights to avoid visibly misaligning, but giving Cancel the full weight would blur which button is primary.
- `size="touch"`'s own global 44px/12px/500 styling is never changed — these are call-site overrides only.

**Implementation.** `src/components/shared/useOverlay.ts` (the layout-effect focus fix); `MOVIMIENTO_PRIMARY_CTA_CLASS` lives in its own module, `src/features/movimientos/movimientoPrimaryCta.ts` (not exported from either sheet component — a component file should own its own render, not double as a shared value's source of truth), imported by both `AddMovimientoSheet.tsx` and `MovimientoSheet.tsx`.

### 10.48 A blocked submit brings the failing field into view

**Goal.** When Save is tapped and validation blocks it (no category, invalid amount), the user must actually see why — not have the error message sit below a software-keyboard fold with nothing drawing attention to it.

**Rules.**

- `useMovimientoForm` tracks `submitAttempts: number`, incremented on every `submit()` call (blocked or not) and reset alongside `reset()` — unlike `amountErrorReason`/`categoriaMissing`, this changes even on a repeated tap that hits the identical invalid state, which is what's needed to re-trigger the "bring it into view" behavior on a second blocked tap.
- On a blocked submit, the form must bring the actual failing section into view (`scrollIntoView({ block: 'center' })`) rather than only relying on wherever the inline error happens to sit in the DOM.
- This is a layout-independent fix: it wraps each field's own section in a ref, not an assumption about field order — so it survives a later redesign of the field order.
- Applies identically to both the create sheet and the edit form — they render the same `MovimientoFormFields`, so the same defect shape exists in both, even though it's harder to trigger in edit mode (no auto-focused amount field there).
- Errors surface inline, next to the field that failed — never as a Toast — because the form's own surface is still open and visible; a Toast is reserved for failures where no such surface exists.

**Implementation.** `useMovimientoForm.ts` (`submitAttempts`), `MovimientoFormFields.tsx` (the `useEffect` keyed on `submitAttempts`, one ref per section).

**Watch out.** `AmountField.tsx` no longer exists — `MovimientoAmountInput` (§10.41) is the only amount input. `src/lib/i18n/amountFormat.ts`'s `parseAmountForInput`/`formatAmountForInput`/`isAmountInputInvalid` are used only by `useMovimientoForm.ts` and `MovimientoAmountInput.tsx`.

### 10.49 Overlays hold still while the software keyboard opens

**Goal.** A `BottomSheet`/`CenterModal` with a focused field stays put as the keyboard rises — it never flies up and settles back, and never exposes a strip of the page behind it.

**Rules.**

- Nothing reads `window.visualViewport` to position or size an overlay. iOS reports the keyboard pan as sparse, drifting samples that keep arriving after the keyboard has already settled; writing those into a `fixed` layer's `top`/`height` is itself what makes the panel visibly fly and land.
- Panels are bounded by CSS alone (`max-h-[88dvh]`) and scroll internally (`overflow-y-auto overscroll-y-contain` on `CenterModal`, on the body wrapper in `BottomSheet`). No JS ever writes an inline height or offset onto a shell.
- No shell and no field scrolls anything in response to a field being focused, or to an overlay resizing around a focused field. iOS reveals the focused field on its own; a second scroll stacked on top of that is what compounds into the jump instead of preventing it. §10.48's scroll on a _blocked submit_ is a different trigger and stays.
- The document itself never scrolls behind an overlay: `html`/`body`/`#root` are `height: 100%` and every screen scrolls in an inner container (§10.34), so the body-scroll lock is `overflow: hidden` alone and there is no page pan for a `fixed` layer to be dragged by.
- The backdrop is a `fixed` sibling of the panel wrapper, never its descendant, so it keeps dimming the whole layout viewport independently of whatever happens to the panel; §10.53 owns how far it overscans.

**Implementation.** `src/components/shared/useOverlay.ts` (the lock and the overscan constants), `BottomSheet.tsx`, `CenterModal.tsx`.

**Watch out.** `dvh` does not shrink for the keyboard on iOS, and in an installed PWA it shrinks on the first keyboard open and never recovers for that session — so `88dvh` is an upper bound, never a promise that the panel fits above the keyboard. The panel's own internal scroll is what keeps a low field reachable.

### 10.50 The date picker floats on a Radix popover

**Goal.** Picking a date opens a calendar layered above the sheet that owns the screen, without displacing anything under it.

**Rules.**

- The calendar renders the month's own real span — a five-week month is five rows, never padded to a fixed six.
- Every day cell is at least 44px, sized from `--cell-size` rather than an aspect ratio that shrinks with the container.
- `DateChipPicker`'s props are `value`/`onChange`/`firstDayOfWeek`/`locale`/`dateFnsLocale`/`className`/`ref`; it takes `firstDayOfWeek` as a prop rather than reading `Config`, keeping it repo-agnostic.
- Weekday initials, month names and the first day of the week follow `dateFnsLocale`; each day carries a full localized accessible name; `groupLabel`/`prevMonth`/`nextMonth` resolve through the `dateChipPicker` namespace in all four locale files.
- An in-month, unselected day cell that is today shows a `ring-1 ring-inset ring-primary` ring.
- The caption is a month dropdown and a year dropdown — bare text plus a chevron, no border or fill — alongside the prev/next chevrons, which the dropdown layout leaves in place. Focus-visible is a `box-shadow` ring, independent of any border, and the 44px floor comes from `--cell-size` on a border-box element, so neither depends on the frame.
- The year list spans 15 years back to one ahead by default. `react-day-picker` defaults to a hundred, which is a worse control than the arrows it replaces. A caller may pass `maxDate` to cap both the reachable month/year range and the individual selectable days to on-or-before that date — the movement sheet passes today's date, since a movement's own totals (§4) are derived from stored rows with no "pending" concept, and a future-dated one would misstate a not-yet-real balance; a caller with no such constraint (the search filter) omits it and keeps the wider default range.
- The dropdowns' own accessible names resolve through `dateChipPicker.monthDropdown`/`yearDropdown`; `react-day-picker`'s defaults for them are hardcoded English, unlike its month and weekday text, which follows the threaded locale.
- Escape closes the calendar and leaves an ancestor `BottomSheet`/`CenterModal` open; a second Escape closes that. `PopoverContent` stops propagation on `onEscapeKeyDown` because Radix's `DismissableLayer` handles Escape in the capture phase and would otherwise pop the shared overlay handle (§10.5.1) before the sheet's own bubble-phase listener reads the stack, making the sheet believe it is the top layer.
- `useEscapeToClose` is still called, solely to register the calendar on the shared overlay stack so `BottomNav` hides (§10.53); its Escape callback is unreachable for the reason above.
- Outside-tap dismissal keeps Radix's `pointerdown` semantics, deliberately deviating from §10.53's "commit on `pointerup`, gesture must have started outside" rule.
- `PopoverContent` caps its height at `--radix-popper-available-height` with an `88dvh` fallback, carries `collisionPadding`, and scrolls internally. Radix's Popper writes that variable from the same overflow detection that drives its flip, so the box shrinks to whatever side it landed on; a flat viewport fraction taller than that space renders it at a negative offset instead. The fallback matters because an absent variable resolves `max-height` to `none` — unbounded, which is the original defect returning with nothing to signal it.
- A consumer whose popover has its own action row overrides `overflow` on `PopoverContent` and owns an inner scroll region, keeping the actions a `shrink-0` sibling. Actions inside the scrolling region are what put an untappable button below the fold to begin with.
- The calendar's `root` and `months` are positioned. `Nav` is a sibling of `Month` inside `Months` and positions absolutely; the project themes the calendar entirely in Tailwind and never imports `react-day-picker`'s stylesheet, where those two carry the `position: relative` this depends on. Without it the chevrons resolve against Radix's popper wrapper and sit above the caption row.
- Tailwind v4 compiles a bare `data-name:` variant to an attribute-presence selector. Radix state is `data-state="open"|"closed"`, so animations bind to `data-[state=open]`/`data-[state=closed]`; a bare `data-open:` matches nothing and fails silently.

**Implementation.** `src/components/shared/DateChipPicker.tsx` over `src/components/ui/calendar.tsx` (`react-day-picker`) and `src/components/ui/popover.tsx` (Radix), both rethemed onto the tokens in `src/styles/index.css`.

**Watch out.** The caption dropdowns are native `<select>`s, the only ones in the app. On iOS they raise the OS picker wheel as a layer above both the popover and the sheet; `useOverlay.ts` binds nothing to focus events so its own bookkeeping is unaffected, but Radix's `DismissableLayer` dismisses on focus activity it reads as outside, which a WebKit blur-then-refocus around the wheel could trigger. Unverified on a device.

**Watch out.** `bunx shadcn@latest add <name>` overwrites primitives it considers its own — it silently replaced `button.tsx` and destroyed the custom `touch`/`icon-touch` size variants. Diff `src/components/ui/` after every add.

### 10.51 A blocked submit moves focus, it does not blur unconditionally

**Goal.** Bringing a blocked field into view (§10.48) must not strand a keyboard user's focus at the top of the document.

**Rules.**

- The blocked-submit effect must call `.focus()` on the first focusable element inside whichever section blocked the save (the amount input, or the category section's own focusable control) — it must **never** call `document.activeElement?.blur()` unconditionally first.
- Reason: in Chrome and keyboard-driven Safari, clicking or Enter-activating the submit button leaves the button itself as `document.activeElement`. Blurring it unconditionally drops focus to `<body>`, with no way back for a keyboard user short of tabbing from the very top of the document.
- Moving focus to the real target still dismisses an iOS on-screen keyboard as a side effect whenever the new target isn't the already-focused text input (moving focus off a text field closes the software keyboard on its own — no explicit `blur()` is needed for that case).

**Implementation.** The effect lives in `MovimientoFormFields.tsx`, using the same focusable-element selector `useOverlay.ts` exports (`FOCUSABLE_SELECTOR`) to find the section's first focusable descendant.

### 10.52 The movement note is a textarea, stored as one line

**Goal.** A description has room to be written and read, without a multi-line note reshaping a movement row.

**Rules.**

- The note field is a two-row `<textarea>` (`TextAreaField`), not a single-line input, capped at 180 characters. It carries `min-h-11` and `text-base` explicitly — below 16px iOS zooms the page on focus.
- `TextField` stays the single-line primitive; the two are separate components and every existing `TextField` caller is untouched.
- A character counter appears once the value reaches 75% of `maxLength`, so the ceiling is visible before `maxLength` silently truncates a paste.
- The counter's row is always present whenever `maxLength` is set, reserving its height with `min-h-4`; only its text is conditional. Mounting it on threshold instead pushes the form's submit button down mid-typing.
- `submit()` collapses every whitespace run in `nota`, newlines included, to single spaces. Both the create and the edit path funnel through it, and nothing else writes `nota`.
- A movement row renders `nota` on one line: `truncate` sets `white-space: nowrap`, which turns segment breaks into spaces, so rows written by any client generation single-line regardless of what they contain.

**Implementation.** `src/components/shared/TextAreaField.tsx`, wired in `src/features/movimientos/MovimientoFormFields.tsx`; the collapse lives in `useMovimientoForm.ts`.

### 10.53 Backdrop uncoverable, BottomNav hidden under any overlay, portrait lock

**Goal.** A `BottomSheet`/`CenterModal`'s backdrop can never let `BottomNav` (or anything else) show through under a real device's keyboard-driven pan; the bottom nav is inert while any overlay is open; the app stays portrait wherever a real platform lock is available.

**Rules.**

- The backdrop is unconditionally oversized: it overscans a plain `inset-0` by `OVERLAY_BACKDROP_OVERSCAN_BLOCK`/`_INLINE` (`-50dvh`/`-50dvw`) on every edge, a flat constant derived from no measurement — robust to the _class_ of error (a `fixed` element's rendered box coming out smaller or offset than reasoned, §10.49) rather than to one specific geometry.
- `useHasOpenOverlay()` (`useOverlay.ts`, via `useSyncExternalStore` over the same stack §10.5.1 describes) is true whenever any overlay anywhere is open. `BottomNav` reads it directly, not a prop threaded from `AppShell`, so it reacts to every overlay app-wide, not just the sheets `AppShell` happens to own.
- `BottomNav` hides via `opacity-0 pointer-events-none` while any overlay is open — never unmount, `display: none`, or `inert`. `useOverlay` restores focus to the trigger element (often `BottomNav`'s own Add FAB) synchronously on close, one render tick before this hook's own state update repaints the bar visible again; `opacity`/`pointer-events` don't affect scriptable focusability, so the restore still lands.
- No orientation lock is called via the Screen Orientation API anywhere (`screen.orientation.lock()` is unimplemented on iOS Safari and redundant with the manifest where it would work) — the manifest's `orientation: 'portrait'` is the only lock for an installed PWA/TWA; a bare mobile browser tab has no real platform lock available at all.
- `LandscapeGuard` (mounted once in `src/main.tsx`, above `AppLock` and the router) renders nothing in portrait and a full-screen blocking `role="status"` in landscape for that unlockable browser-tab case — mounted above the router specifically so it also covers the auth screens, the PIN lock, and `/settings`, not just the three bottom-nav tabs.
- The gate's "Omitir y continuar" skip is session-scoped, not per-device: in-memory zustand state with no persistence, so it dismisses the gate for the rest of the running app but a reload or a fresh launch shows it again once. It renders synchronously off that state — no async storage read, so no tri-state "not resolved yet" is needed to avoid a flash.

**Implementation.** `src/components/shared/useIsLandscape.ts` (`matchMedia` via `useSyncExternalStore`) + `LandscapeGuard.tsx` (presentation only, kept separate so a future design swaps `LandscapeGuard`'s body alone) + `src/lib/landscapeGateStore.ts` (the session skip); `BottomNav.tsx`, `useOverlay.ts` (overscan constants), `BottomSheet.tsx`/`CenterModal.tsx`.

**Watch out.** iOS has no documented equivalent to the manifest orientation lock even when installed to the home screen — the portrait guarantee on iOS rests entirely on `LandscapeGuard`, not a platform-level lock.

### 10.54 The amount keypad: where it exists, what dismisses it, what its keys do

**Goal.** `MovimientoAmountInput`'s on-screen `NumericKeypad` (§10.41) replaces the OS keyboard on a touch device, and dismisses on a genuine outside tap — never on a focus change, which no platform agrees about.

**Rules.**

- It exists only on a coarse-pointer device (`useIsCoarsePointer`); a desktop gets an ordinary `inputMode="decimal"` field with no pad and none of its gesture wiring mounted.
- Visibility is never derived from `focus`/`blur`. The sole dismissal is a gesture whose own `pointerdown` landed outside, committed on `pointerup` — never on `pointerdown`, so the collapse can't move the layout out from under a tap still in flight. `pointercancel` never dismisses.
- "Outside" is the input and the pad; the label, the currency symbol and the empty flanks beside the digits all dismiss. The pad's box spans the sheet's true edges including its `px-5.5` gutters, so the strip beside the outer keys belongs to it — computed against this element's own parent, never a viewport unit.
- Tab off the pad's last key is the one keyboard-driven close, gated on an explicit forward `Tab` keydown and run on the following `focusout` — never a bare `focusout`, which a touch-driven focus walk also produces.
- Keys are `aria-disabled`, never natively `disabled`: a native `disabled` control dispatches no pointer events at all, which blinds the gesture bookkeeping above for exactly the disabled key.
- Delete removes the digit or decimal separator before the caret, skipping back over an auto-inserted grouping separator so it takes content rather than formatting, and auto-repeats while held (this caller only).
- The digits render at one size for every amount; `NumericKeypad` renders `size="compact"` here. `PinPad`/`LockScreen` pass neither and are unaffected by every rule above — the coarse-pointer gate deliberately does not extend to them, since `PinPad` is those screens' only visible way to enter a PIN and no desktop design exists to replace it.
- `?debugKeypad=1` arms `keypadDebugLog.ts`, a read-only mirror of pointer/touch/focus activity that never feeds a decision.

**Implementation.** `src/features/movimientos/MovimientoAmountInput.tsx`, `keypadDebugLog.ts`, `src/components/shared/useIsCoarsePointer.ts` (on `useMediaQuery`, shared with `useIsLandscape`).

**Watch out.** A `click` is re-hit-tested against the post-collapse DOM on touch in Blink, so deferring to `pointerup` protects that gesture's own `pointerup` and not its `click` — §10.35's backdrop rule is what covers the rest.

### 10.55 Single-tab guard — one browsing context at a time

**Goal.** The app is only usable in one tab at a time, on one browser storage partition — a second tab sees a clear "already open" screen instead of a second live instance racing the first.

**Rules.**

- The guard applies to every session, guest included — the one-tab rule is a deliberate, simple product-wide rule, not conditioned on whether Drive sync (the actual race it closes) is active.
- `navigator.locks.request(LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, ...)`, held for the tab's entire lifetime via a callback that returns a never-resolving promise — the browser releases it automatically on tab close, navigation away, or crash.
- Feature-detected: where `navigator.locks` is unsupported, the guard renders `children` unconditionally and never blocks — never break the app over what is otherwise a nice-to-have.
- A short grace-period retry (~250–300ms) before declaring conflict — a hard refresh briefly overlaps the old context releasing the lock with the new one requesting it, and without the retry that overlap intermittently misreports "already open."
- Two tabs of a genuinely different storage partition (a normal tab and a private/incognito one, or two different origins) are never detected or blocked — that boundary is a deliberate browser privacy wall, not a gap, and `specs.md` §10.19's per-device sharding already treats it as just another device.

**Implementation.** `src/lib/singleTabGuard.ts` (the lock/retry store), `src/features/boot/SingleTabGuard.tsx` (mounted in `src/main.tsx`, ahead of `AppLock`/the router, the same architectural spot as `LandscapeGuard`).

## 11. Backlog (pending verification / deferred work)

### Performance & gestures (priority)

- **`BottomSheet`'s drag-to-dismiss re-renders React on every `pointermove`** — `handlePointerMove` calls `setDragY` per event instead of mutating the panel's `transform` directly via a ref during the drag, only committing to state once on release. Every sheet in the app (categories, add movimiento, profile) inherits the jank from this one component (`src/components/shared/BottomSheet.tsx`).
- **Horizontal scroll rows have no `overscroll-behavior-x: contain`** — `CategoryPicker` and `PeriodPickerRow` can chain their scroll into the page's vertical scroll at their horizontal edges (`src/features/tags/CategoryPicker.tsx`, `src/features/history/PeriodPickerRow.tsx`).

### Native distribution — Capacitor migration (priority 2)

- **Distribution moves to the app stores; the web build stops being a usable target.** Google Play and the Apple App Store become the primary (only) way people run the app; the site at the current domain turns into a landing page whose one job is to send a visitor to the right store listing. Resolves `docs/pendientes-usuario.md`'s former item 28 (TWA vs. Capacitor) — Capacitor wins because the App Store cannot install a TWA at all, and it wraps the existing React/Vite/TS codebase instead of demanding a rewrite.
- **Local storage moves from dexie/IndexedDB to Capacitor's SQLite plugin** (`@capacitor-community/sqlite`), reached through the same `Repo` port (§10.3) — `repo.local.ts` gets a SQLite-backed sibling behind the existing interface, no screen changes.
- Resolves the two iOS keyboard bugs the web has no fix for (§10.5.1/item 27, item 29): `Keyboard.setAccessoryBarVisible(false)` removes the AutoFill bar over the sheet bottom, `Keyboard.setResizeMode('native')` removes the `dvh`-drift viewport pan.
- `vite-plugin-pwa`, the service-worker update flow (§10.16) and static hosting stop being load-bearing once the app stores are the distribution path — evaluate what to keep only for the landing page versus what gets removed with the migration.
- Auth/Drive sync (§5, §10.19) is unaffected in principle — Capacitor's WebView still runs the same GIS/Drive code — but the OAuth redirect flow needs a native-capable variant (`@capacitor/browser` or an in-app browser tab) since a packaged app has no origin for the popup-based flow to return to.

### Sync & outbox correctness

- **`ProfilesSection.test.tsx`'s "this device" case failed intermittently in a full run, never in isolation.** Reviewed: no state-leak found (the one non-atomic read-then-write in `getActiveProfile()` converges on a fixed id, so it's benign, not the cause). Mitigated by widening that assertion's `findByText` timeout (full-suite CPU contention vs. Testing Library's 1000ms default is the best-supported explanation) — not a confirmed root cause. If it recurs, capture the actual CI failure output before guessing further.
- **The search filter's custom range is two chips, not one range calendar.** `poc/date-range` carries a `RangeDateChipPicker` (two-tap draft, explicit apply, footer outside the scroll region) that works but has no tests and is not wired into `main`. Deciding it in means writing its coverage and choosing whether it lives in `features/search/` or moves to `components/shared/`.
- **A `config` sync operation still carries the whole `Config` object** under a single shared entity id, so two offline devices each writing config replay as two whole-object `put`s and the later one silently wins outright. The `categorias` half of this — the part that causes real, visible data loss — is scoped as `docs/tasks/categoria-own-sync-entity.md`; the remaining scalar `preferencias` fields keep whole-object last-write-wins, an accepted low-stakes risk.
- **The Drive status row can read "up to date" right after a sync attempt that just failed** — `src/lib/sync/status.ts`'s `deriveSyncIndicator` never reads `useSyncStore.lastError`, only `isSyncing`/`outboxDirty`.

### Auth, lock & profiles

- **Switching to a different profile keeps showing the Google account's own name rather than the profile being switched to** (e.g. no "Guest" label after switching to the local profile) — not yet traced to a specific component, needs investigation.
- **A Google-authenticated profile can read as "active" with the cloud icon without Drive ever having been connected** — declining `DrivePermissionScreen` at login leaves no visible entry point back to it (`driveConsent.reassurance` promises "you'll be able to do it later from your Profile," but nothing in the Profile screen does that yet). `docs/tasks/profile-data-erasure.md` and `docs/tasks/drive-status-honesty.md` both need a real Drive-connected profile to verify by hand and are currently blocked on this. Once resolved, also worth a manual check: a guest movement adopted while offline should push to Drive on its own once the device reconnects (the adopt itself never depends on connectivity, only the deferred push does).
- **A vault-invalidation failure on sign-out is only logged, not retried** — `src/lib/authStore.ts`'s `invalidateVaultOnLogout` catches `resetVault()` throwing with `console.error` alone; the tab still signs out, leaving a vault row that can resurface a stale PIN screen later.
- **`resolveGoogleProfile` never refreshes a profile's stored label when the Google display name changes**, and no rename UI exists yet (`src/lib/profiles/profileRegistry.ts`).
- **`ProfileRecord`/`ProfileRow` has no `email` field** — only `accountKey` (the Google `sub`), so the returning-user screen can show an email only on the rare profile where `accountKey` happens to be one (`profileRegistry.ts`, `src/lib/deviceStore.ts`).
- **The default local profile's label is hardcoded `'Local'`**, not localized (`profileRegistry.ts`'s `defaultProfileRecord()`).
- **A guest's individually-revoked biometric credential is undetectable** by WebAuthn's own design, so it stays retriable-forever. Needs a dedicated "reset guest lock" recovery surface — a product decision, not a bug fix.

### Data model & feature gaps

- **`Movimiento.metodo` has no writer anywhere** — optional field, seeded only by `repo.fake.ts`'s demo data, no UI control writes it (`src/lib/schema.ts`).
- **`MovimientoRow` has no amount-masking prop**, so History's hide/show-amounts toggle from the design isn't built (`src/features/history/README.md`).
- **"Áreas" (category groups) is designed but unbuilt** — `src/features/home/AreasBanner.tsx` renders disabled; `schema.ts` has no `Grupo` concept, so it needs a new type or an `extra` field on `Categoria` first.
- **Future-dated movements, if ever wanted, should stay flag-free** — derive "counts toward the balance" from `fecha <= today` in `movimientoStats.ts` at read time, not a stored pending/confirmed state; totals are already derived, never cached, so a future date starts counting on its own the moment it's reached.
- **No CI check catches a `SCHEMA_VERSION` bump that ships without a matching entry in `repo.local.ts`'s `MIGRATIONS`** — only the "structural change ⇒ bump + migration in the same change" rule (`AGENTS.md`) prevents it today. Worth a test asserting every version from 1 to `SCHEMA_VERSION` has a registered migration, but not before the app has real users — revisit close to a production launch, not now.

### i18n & accessibility

- **The category icon grid's accessible labels are still raw English icon keys** (`"dumbbell"`, `"party-popper"`) — no translated icon-name table exists, unlike `COLOR_NAME_KEY` for colors (`src/features/tags/CategoryFormModal.tsx`).
- **Three more `'yyyy-MM-dd'` reimplementations remain**, outside the ones already fixed via `toIsoDate`: `src/components/shared/DateChipPicker.tsx`, `src/lib/repo.fake.ts`, `src/lib/export/index.ts`.
- **Neutral `es` still formats numbers as `es-CO` for every country it covers** — deliberate until a language/region picker exists in Settings; none built yet (`src/lib/i18n/localeFormatting.ts`).
- **`sync/validate.ts`'s header comment undersells its own strictness** — says the module "stays permissive on business rules" while `isValidMovimiento` already enforces `monto > 0`.
- **A cold boot briefly shows the device-detected language, not the stored one** — `src/lib/i18n/index.ts` initializes synchronously with `detectLocale()` before the stored `idioma` resolves from IndexedDB.
- **`DateChipPicker` still has no `min`/`max` prop** — no screen has needed a bounded range yet.
- **A selected `neutral` `TagChip` is weakly distinguishable from unselected in dark mode** — a design-weight call, not yet made.

### Security / accepted limitations

- **Whether local financial data should be encrypted at rest is still an open analysis, not a decision.** Only the OAuth token vault is encrypted today; `Movimiento`/`Config` sit unencrypted in IndexedDB (`src/lib/db.ts`).
- A guest's data has no Drive backup and is permanently local-only by design — the one case "data loss with no recovery path" still describes, now that Drive sync covers every signed-in profile.
- The 7-hour offline-write window compares wall-clock time, so a device clock change can shift the boundary — benign either direction, no trusted time source exists without a backend.
- `config-<device>.json` never compacts — fine unless a real account's file is observed growing unreasonably.
- The "most recently used" profile comparison only works within one device — revisit if profiles are ever synced cross-device (no such sync exists).

### Shell & viewport

- **`AppShell`'s outer shell scrolls as a whole, in addition to its own inner content scroll, on a real iPhone** — dragging from around the bottom-nav area drags the whole shell (nav included) up rather than only scrolling the inner content, revealing space below it. Confirmed on `main` directly, unrelated to the guest-adoption/single-tab-guard/outbox batch. Not reproducible on desktop or in Playwright (`env(safe-area-inset-*)` is 0 there); the same class of bug §10.34/§10.39's `min-h-dvh` sweep already covers, but that sweep alone hasn't closed this instance.

### Onboarding

- **No first-run walkthrough exists** — a new user goes straight from `WelcomeScreen`/`DrivePermissionScreen` (auth + Drive opt-in only, §10.4) to the empty Home screen, with no feature-tutorial flow of the kind native apps typically show on first open. No design-canvas artboard covers this yet — needs design work before it can be built.

### Branding / polish

- **Diff every design-canvas artboard against its spec section** — a one-time audit, still not done for most of the 19 artboards.
- **Google's consent screen shows "Learn why you're not seeing links to kurobello.com privacy or terms of service"** — Google withholds those links until a Privacy Policy and Terms of Service page are published under the domain, the domain is verified via Google Search Console, and both are set in the OAuth consent screen's config alongside `kurobello.com` in "Authorized domains". Purely cosmetic on the consent screen today, no functional block — deferred until closer to a real launch, when the domain needs real pages anyway.
- Rename the OAuth consent screen to the current brand name in Google Cloud Console — a user action, no code change.
- **Profile → Preferences doesn't communicate its state clearly and shows unspecified erratic behavior** — needs a UX pass; not yet diagnosed (`src/features/profile/PreferencesSection.tsx`, `src/features/settings/PreferencesEditor.tsx`).
- **`FilterSheet`'s Clear/Apply buttons sit at the end of the scrolling body**, after the tag grid — with many categories the buttons scroll far below the fold. `BottomSheet`/`OverlayShellProps` has no fixed-footer slot today; `poc/date-range`'s `RangeDateChipPicker` already prototypes a footer pinned outside the scroll region, the pattern to generalize into `BottomSheet` rather than inventing a floating control (`src/features/search/FilterSheet.tsx`).

### Waiting on the user

The real list lives in `docs/pendientes-usuario.md` — ask about every open item there each session: verifying `connectDrive` against real Drive (item 4), the guest-cliff profile switcher (item 6), the brand/PWA icon (item 8), where the biometric option lives (item 11), the Add sheet's gear button (item 12), and the portrait-lock device check (item 19).

---
