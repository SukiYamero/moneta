# src/lib

Shared stores, helpers, and the Drive/auth/lock logic layer. No UI here.

- `schema.ts` — the data-model contract (`Movimiento`, `Activo`, `Config`
  types + `SCHEMA_VERSION`). Import it, never redefine the types.
- `branding.ts` — `APP_NAME`, the single source for the display name.
- `i18n/` — the translation table (`react-i18next`/`i18next`, bundled JSON,
  four locales: `es`/`en`/`es-AR`/`pt-BR`, `es` base and fallback, key parity
  across all four enforced by a test). Own `README.md`.
- `auth.ts` — GIS token-client wrapper: identity scopes at login, Drive
  scopes requested incrementally via `connectDrive`.
- `authStore.ts` — zustand store wrapping `auth.ts`; owns session status and
  triggers `bootstrap.ts` through `connectDrive`. Also owns
  `continueAsGuest()`, the guest entry path (`status: 'guest'`, distinct
  from `'authenticated'` — never a synthesized user, `specs.md` §10.10).
  `restore()`/`hydrate()` no longer gate entry on a network call
  (`specs.md` §10.11): a returning user reaches `authenticated` from local
  evidence alone (the device's login marker, or the PIN-vault's cached
  session/profile) when offline, with `fetchGoogleUser()` running as a
  best-effort background refresh, never a blocking gate.
- `drive.ts` — thin Drive REST client (find/create files & folders).
- `bootstrap.ts` — idempotent provisioning of the `KuroBello` folder + the
  three JSON data files. Find-before-create: `config.json`'s seed is only
  written when no file exists yet, so a stored config is never overwritten.
- `seedConfig.ts` — `buildSeedConfig(region = detectRegion())`: the
  first-run `Config` seed, `monedaPrincipal` derived from the device region
  via `i18n/regionCurrency.ts`. `CONFIG_SEMILLA` itself stays a **static
  constant** — a region-dependent value computed at module-import time is a
  defect shape this project has shipped twice (`specs.md` §11, 2026-08-19);
  this function is what varies, not the constant. Shared by both seeding
  paths (`repo.local.ts`, `bootstrap.ts`) so a fix to one can't drift from
  the other (`specs.md` §10.7).
- `db.ts` — the Dexie (IndexedDB) instance. `v1` has the `LockVault` table;
  `v2` additively adds `movimientos`, `activos`, and a single-row `config`
  table (indexes chosen to serve `Repo`'s `ListQuery` — see the comment
  above `db.version(2)`). `createProfileDb(name)` is the factory behind it
  (`specs.md` §10.15): `db` is `createProfileDb('kurobello')`, the frozen
  first profile, and every additional profile calls the same factory
  against a suffixed name via `profiles/`.
- `pinLock.ts` — WebCrypto envelope encryption for the cached token
  (PIN + optional biometric via WebAuthn PRF). The vault's plaintext is a
  versioned envelope (`{ v: 2, session, user }`, decoded backward-compatibly
  from the pre-envelope v1 shape) so the cached Google profile survives a
  re-lock/cold boot without a network call.
- `lockStore.ts` — zustand store wrapping `pinLock.ts`: lock phase, throttle,
  biometric availability (`biometricAvailable` — platform capability — vs
  `biometricEnrolled` — this vault's own enrollment, see `specs.md` §11,
  2026-08-19).
- `deviceStore.ts` — a separate, tiny Dexie database (`kurobello-device`,
  distinct from `db.ts`'s `kurobello`), the canonical home for every
  non-secret, per-device signal. Four live here: the login marker
  (`hasLoggedInBefore`/`markLoggedIn`/`clearLoggedIn`), which gates
  `authStore.restore()`'s silent re-auth so it can tell a returning user
  apart from a first-ever visit or a just-locked-out device; the Drive-sync
  decision (`getDriveDecision`/`setDriveDecision`/`clearDriveDecision`), so a
  device that already answered the permission prompt is not asked again on
  every cold start (`specs.md` §11, 2026-08-19 — supersedes the 2026-08-18
  in-memory entry); the `anchor` table `networkStore.ts` owns; and the
  `profiles` table `profiles/profileRegistry.ts` owns. The latter two folded
  in from their own short-lived `kurobello-network`/`kurobello-profiles`
  databases (`specs.md` §11, 2026-08-19) — both existed only because Wave 3
  stage 1's file-ownership table left this file unassigned to either track,
  and neither had shipped, so no migration was owed. The database name is
  frozen; only the module was renamed from `loginMarker.ts`. Every function
  self-catches and degrades to "no signal recorded" — storage trouble can
  suppress a convenience, never block boot.
- `networkStore.ts` — a small, self-initialising zustand store (attaches
  `online`/`offline` listeners at module scope, since `main.tsx` is another
  track's file) owning the online/offline hint plus the 7-hour offline
  write window. The window's anchor (last successful online validation) is
  persisted on `deviceStore.ts`'s shared `kurobello-device` connection (its
  `anchor` table). `canWrite(kind, now?)` is the single "may this write
  proceed?" answer: read/create always allowed, edit/delete/settings refused
  offline regardless of the window, create additionally refused past the
  window. Reads no other store.
- `errorCopy.ts` — `RepoErrorCode` → translation key, shared by Home/
  Search/History (moved from `src/features/home/errorCopy.ts`, which was
  never Home-specific — `specs.md` §10.11).
- `toastStore.ts` — the global notification store behind `Toaster`:
  `toast.success(message)` / `toast.error(message)`, callable from anywhere
  with no provider. Holds no domain state and reads no other store
  (`specs.md` §10.6) — `setToastsSuppressed(boolean)` is a domain-free flag
  `AppLock` drives from the lock phase, so the dependency points policy →
  surface and nothing that merely raises a toast pulls in WebCrypto/Dexie.
  Stack capped at 3, one independent timer per card (4s success / 7s error),
  identical re-raises collapse instead of stacking. Suppressing also clears
  what is already on screen, so nothing can resurface after an unlock.
  Callers pass a **translation key** (`ToastMessageKey`) plus optional
  interpolation values and the store resolves the copy itself, so a raw
  `error.message` is a compile error rather than a convention
  (`docs/error-handling.md` §5/§7). An optional third argument,
  `ToastAction` (`{ labelKey, onAction }`), gives a card a one-tap
  affordance next to dismiss — `swUpdate.ts`'s update prompt is the first
  caller. `onAction` is `() => void`, not `() => Promise<void>`: an async
  action self-catches before it's handed here, the same "a store action
  fully owns its own error handling" rule every other store follows.
- `swUpdate.ts` — service-worker update lifecycle (`specs.md` §10.16). A pure
  `createSwUpdateController(registerSW)` factory around `virtual:pwa-register`
  (`vite.config.ts`'s `registerType: 'prompt'`), injectable so tests never
  need the real virtual module. Raises `toast.success('update:available')`
  when a new version is waiting; polls `registration.update()` hourly so a
  tab that never navigates still notices a deploy; a failed poll (offline)
  and a registration failure are both swallowed/logged, never toasted — only
  a deliberate call to `applyServiceWorkerUpdate()` ever applies the update
  and reloads, so nothing here can interrupt a user mid-session on its own.
  `initServiceWorkerUpdates()` (called once from `main.tsx`) is the real
  entry point. The `onNeedRefresh` toast carries a `ToastAction` ("Recargar")
  that applies _this controller's own_ injected `updateServiceWorker`
  directly, not the module-level `applyServiceWorkerUpdate` singleton below —
  routing the toast action through the singleton would make this factory's
  own tests depend on state outside what they inject. `applyServiceWorkerUpdate`
  remains exported for any future non-toast caller.
- `utils.ts` — `cn()`, the Tailwind class-merge helper.
- `repo.ts` — the storage-agnostic `Repo` port contract (`Repo`, `CrudRepo`,
  `ListQuery`, `ListResult`, `RepoError`). Frozen shape — additive changes
  only (see `specs.md` §10.3/§11).
- `repo.local.ts` — the real dexie-backed `Repo` implementation
  (`createLocalRepo()`): schemaVersion seeding/migration gate, generic
  `CrudRepo<T>` factory (shared by `movimientos`/`activos`) with keyset
  pagination, write validation, and atomic bulk paths. Its fresh-store seed
  goes through `buildSeedConfig()`, not a raw `CONFIG_SEMILLA` copy. Tests in
  `repo.local.test.ts`. The Drive-backed implementation is a future sibling
  file behind the same port.
- `repo.fake.ts` — in-memory `Repo` implementation, seeded with deterministic
  Spanish sample data (`createFakeRepo()` for an isolated instance, the
  `fakeRepo` singleton for app code — see `specs.md` §10.5).
- `movimientoStats.ts` — pure derivation of every number the Home/History/
  Search screens show, from `Movimiento[]` (`specs.md` §4: views are derived,
  never stored). `periodRange()`, `filterByRange()`, `totals()`,
  `breakdownBy()`, `series()`. No imports from stores/UI/repo — trivially
  testable, reusable by all three screens so their numbers cannot disagree.
  Sums in integer minor units (never a naive float `+=`); dates compared as
  ISO strings or parsed with `date-fns`'s `parseISO` (never `new Date(iso)`,
  which shifts a date-only string by a day under a negative-offset TZ);
  `series()` buckets are clamped to their period, so the bars always sum to
  the total printed beside them.
- `dataStore.ts` — zustand store holding the raw `movimientos`/`activos`/
  `config` the Wave 2 screens read, plus `status`/`error`. No derived totals
  cached here — screens compute those from `movimientoStats` at the call
  site. `load()` is idempotent and race-safe (mirrors `authStore.restore()`'s
  synchronous check-then-set guard) and owns its own error handling end to
  end: a failure lands in `error` as a `RepoErrorCode`, never thrown past
  `load()`. `createMovimiento`/`updateMovimiento`/`deleteMovimiento`/
  `updateConfig` (`specs.md` §10.13) are the write path Wave 4 builds on, all
  sharing one `runMutation()`: a single `networkStore.canWrite()` check (the
  only place the offline policy is enforced), an optimistic apply in
  zustand's updater form so concurrent mutations can't clobber each other,
  the repo write, then the outbox enqueue — never the reverse. A repo failure
  rolls the store back and raises a Toast (`docs/error-handling.md` §7 — a
  store, not a form); it never throws past the action, same contract as
  `load()`.
- `hlc.ts` — a purely local hybrid logical clock (`specs.md` §10.19).
  `tick()` yields a strictly increasing `Hlc`, encoded so two values compare
  correctly as plain strings. It never folds in a remote clock value on
  purpose: a device only ever writes its own Drive file.
- `outbox.ts` — the append-only queue of operations not yet pushed to Drive
  (`specs.md` §10.13/§10.19) plus the `dirty` flag a future flush trigger
  reads. Holds the op envelope (`hlc`, `basedOn`, `device`). Track Z's sync
  engine is its first reader; nothing consumes it yet, deliberately — the
  same bet that paid off building the Toast a wave before its first caller.
- `repoProvider.ts` — the single swap point: `getRepo()` returns the shared
  fake `Repo` today. `// STUB(wave3)` marks the one line to change once a
  Drive-backed `Repo` exists (`specs.md` §12). `getActiveProfileRepo()`
  builds the real per-profile-scoped repo and is fully tested, but nothing
  calls it yet — the flip is gated on Wave 4's create UI.
- `profiles/` — the device-scoped profile registry (`specs.md` §10.15). One
  dexie database per profile (via `db.ts`'s `createProfileDb()`); the
  registry itself lives in `deviceStore.ts`'s shared `kurobello-device`
  connection (its `profiles` table). `getActiveProfile()` resolves which one
  is active by recency, with no switcher UI yet. Own `README.md`.
- `repo.contract.ts` — shared `Repo` behavior every implementation must
  agree on (`testRepoContract()`), invoked from both `repo.local.test.ts`
  and `repo.fake.test.ts` (`docs/error-handling.md` §6). A plain module, not
  a `*.test.ts` file, so vitest doesn't collect it as its own standalone
  suite.
- `export/` — CSV export of the user's movements (`specs.md` §10.12): pure
  serialisation (`csv.ts`) split from platform delivery (`delivery.ts`,
  `navigator.share` with a download-link fallback), orchestrated by
  `index.ts`'s `exportMovimientosToCsv()`. Reads through `getRepo()`; no UI
  trigger yet (`specs.md` §10.18 wires it in a later stage). Own `README.md`.
