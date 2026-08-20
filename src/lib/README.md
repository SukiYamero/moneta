# src/lib

Shared stores, helpers, and the Drive/auth/lock logic layer. No UI here.

- `schema.ts` — the data-model contract (`Movimiento`, `Activo`, `Config`
  types + `SCHEMA_VERSION`). Import it, never redefine the types.
  `Categoria.icono`/`.color` type onto `CategoryIconKey`/`IconAvatarTint`
  from the two leaf modules below, never from `src/features/tags/` or
  `src/components/shared/IconAvatar.tsx` directly — this file is the
  contract the rest of the app imports, so it only ever imports other
  `src/lib/` leaves itself (`specs.md` §11, 2026-08-20).
- `categoryIconKeys.ts` — the plain, stable-ordered `CATEGORY_ICON_KEYS`
  list and the `CategoryIconKey` union it derives — no `lucide-react`
  import. `src/components/shared/categoryIcons.ts` re-exports both and
  pairs each key with its actual `LucideIcon`; a `satisfies` check there
  keeps the two lists honest against each other.
- `iconAvatarTint.ts` — the plain `IconAvatarTint` union (nine tint names),
  re-exported by `src/components/shared/IconAvatar.tsx` for every existing
  consumer of that import path.
- `branding.ts` — `APP_NAME`, the single source for the display name.
- `i18n/` — the translation table (`react-i18next`/`i18next`, bundled JSON,
  four locales: `es`/`en`/`es-AR`/`pt-BR`, `es` base and fallback, key parity
  across all four enforced by a test). Own `README.md`.
- `auth.ts` — GIS token-client wrapper: identity scopes at login, Drive
  scopes requested incrementally via `connectDrive`.
- `authStore.ts` — zustand store wrapping `auth.ts`; owns session status and
  triggers `bootstrap.ts` through `connectDrive`. Also owns
  `continueAsGuest()`, the guest entry path (`status: 'guest'`, distinct
  from `'authenticated'` — never a synthesized user, `specs.md` §10.10) —
  it also touches the default local profile's recency
  (`profiles.touchLastUsed(DEFAULT_PROFILE_ID)`), so `getActiveProfile()`'s
  purely-recency resolution can't land a guest in whatever Google account
  was last signed out of (`specs.md` §10.28). `continueAsGuest()` is `async`
  internally (typed `() => void` on `AuthState` — callers stay
  fire-and-forget) specifically to `await` that touch _before_ the `status`
  flip, not after: `status: 'guest'` is what `RequireAuth` renders
  `BootGate` on, and `BootGate`'s effect reads the registry close enough
  behind it that the unawaited shape lost that race on every run (found and
  fixed during this track's own review — see `specs.md` §11, 2026-08-20).
  `restore()`/`hydrate()` no longer gate entry on a network call
  (`specs.md` §10.11): a returning user reaches `authenticated` from local
  evidence alone (the device's login marker, or the PIN-vault's cached
  session/profile) when offline, with `fetchGoogleUser()` running as a
  best-effort background refresh, never a blocking gate. `login()`/
  `restore()`'s online branch resolve the account's profile-registry entry
  (`syncProfileForAccount`) _before_ flipping `status` to `'authenticated'`,
  not after (`specs.md` §10.28) — otherwise `src/lib/boot.ts` could read the
  active-profile registry the instant `status` flips and resolve whichever
  profile recency last pointed at, not the one that just signed in.
  `hydrate()` needs no equivalent reordering: `lockStore.resume()` already
  awaits its whole promise before leaving `phase: 'locked'`, so the profile
  sync is done before anything below the lock screen can render. `logout()`
  also calls `boot.ts`'s `invalidateBootForSignOut()` — see that function's
  own comment for why a stale `useBootStore` status is otherwise a second,
  independent way the same class of bug resurfaces.
- `drive.ts` — thin Drive REST client: find/create/read/write/delete a
  file or folder, `listFiles()` (paginated `files.list`, the sync engine's
  revision check), `upsertJsonFile`/`upsertTextFile` (find-or-create-then-
  overwrite, distinct from `bootstrap.ts`'s own find-then-keep semantics),
  and `getLastKnownServerTime()` — passively captures the response `Date`
  header from every call for `hlc.ts`'s clock-skew clamp, at no extra
  request cost.
- `bootstrap.ts` — idempotent Drive provisioning under `specs.md` §10.19's
  op-log layout (supersedes the old fixed three-file one): ensures the
  `KuroBello` folder (`FOLDER_NAME`, now defined in `sync/driveFiles.ts`,
  re-exported here for `authStore.ts`'s existing import), rewrites
  `LEEME.txt` on every connect, and — only for a device that has never
  pushed a config file and doesn't already have one queued — enqueues one
  seed `Config` `put` through the normal outbox/push path, so a second
  device linking the same account later doesn't independently derive its
  own region-based default. No longer pre-creates any op-log file itself;
  a device's own shard/config file is created lazily by `sync/engine.ts`'s
  push, the first time it has something to push.
- `seedConfig.ts` — `buildSeedConfig(region = detectRegion(), locale =
detectLocale())`: the first-run `Config` seed. Two independent axes
  (`specs.md` §10.7): `monedaPrincipal` derived from the device region via
  `i18n/regionCurrency.ts`, and the seed section/category **names** derived
  from the active copy locale via a `Record<SupportedLocale, Record<id,
name>>` table (`specs.md` §10.22 Decision 6/§10.25 addendum) — ids never
  change across locales, and once seeded the names are the user's own data,
  never re-resolved at render time. `CONFIG_SEMILLA` itself stays a
  **static constant** — a region-dependent value computed at module-import
  time is a defect shape this project has shipped twice (`specs.md` §11,
  2026-08-19); this function is what varies, not the constant. Shared by
  both seeding paths (`repo.local.ts`, `bootstrap.ts`) so a fix to one can't
  drift from the other.
- `db.ts` — the Dexie (IndexedDB) instance. `v1` has the `LockVault` table;
  `v2` additively adds `movimientos`, `activos`, and a single-row `config`
  table (indexes chosen to serve `Repo`'s `ListQuery` — see the comment
  above `db.version(2)`). `v3` additively adds `outbox` (`outbox.ts`'s queue
  of operations not yet pushed to Drive, `specs.md` §10.13/§10.19) — pending
  operations are per-profile data, so they live beside `movimientos`/`config`
  here rather than on `deviceStore.ts`'s device-wide connection, and not as a
  database of their own as first built. `createProfileDb(name)` is the factory behind it
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
  suppress a convenience, never block boot. `v5`/`v6` add two more
  transport-layer caches for `sync/`: `syncTips` (`sync/tip.ts` — the last
  known hlc per entity, deliberately not app data, so it lives here rather
  than on a profile's own `db.ts` connection) and `syncFileCache`
  (`sync/engine.ts` — a previously-downloaded, already-validated op file
  keyed by Drive fileId, which is what makes the `files.list` revision
  check safe rather than merely faster, since `Movimiento` itself carries
  no hlc/provenance by design).
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
  `repo.local.test.ts`.
- `repo.fake.ts` — in-memory `Repo` implementation, seeded with deterministic
  Spanish sample data (`createFakeRepo()` for an isolated instance, the
  `fakeRepo` singleton for app code — see `specs.md` §10.5).
- `repo.drive.ts` — the third `Repo` implementation (`specs.md` §10.19):
  `createDriveRepo(database)` delegates every call straight to
  `repo.local.ts`'s `createLocalRepo()`, deliberately — §10.19 states the
  local database is always the merged truth, so there is no "read/write
  Drive directly" path for `Repo` methods to take. Passes the identical
  `repo.contract.ts` suite for exactly that reason. What actually makes a
  profile Drive-backed lives in `sync/engine.ts`, outside the `Repo` port.
- `movimientoStats.ts` — pure derivation of every number the Home/History/
  Search screens show, from `Movimiento[]` (`specs.md` §4: views are derived,
  never stored). `periodRange()`, `filterByRange()`, `totals()`,
  `breakdownBy()`, `series()`. No imports from stores/UI/repo — trivially
  testable, reusable by all three screens so their numbers cannot disagree.
  Sums in integer minor units (never a naive float `+=`); dates compared as
  ISO strings or parsed with `date-fns`'s `parseISO` (never `new Date(iso)`,
  which shifts a date-only string by a day under a negative-offset TZ);
  `series()` buckets are clamped to their period, so the bars always sum to
  the total printed beside them. `totals()`/`breakdownBy()`/`series()` all
  take `moneda` as a **required** argument (`specs.md` §10.27, 2026-08-20) —
  a total is never the sum of two currencies, and a default would silently
  reproduce that exact mixing bug at any call site that forgot to pass one.
  `otherCurrencies(movimientos, moneda)` returns the distinct currencies
  present other than `moneda`, empty in the common single-currency case —
  what lets a screen say a total excludes movements instead of silently
  dropping them. `toIsoDate()` is exported so callers that build their own
  date-only ISO strings share one formatting rule instead of redeclaring
  `format(date, 'yyyy-MM-dd')` per file.
- `weekStart.ts` — the `Preferencias.primerDiaSemana` (`0 | 1`) ↔
  `'sunday' | 'monday'` mapping, in both directions (`WEEK_START_KEY`,
  `WEEK_START_VALUE`), from one ordered source — replaces two
  hand-maintained inverse tables that used to live separately in
  `src/features/profile/PreferencesSection.tsx` and
  `src/features/settings/PreferencesEditor.tsx` (`specs.md` §12,
  2026-08-20).
- `dataStore.ts` — zustand store holding the raw `movimientos`/`activos`/
  `config` the Wave 2 screens read, plus `status`/`error`. No derived totals
  cached here — screens compute those from `movimientoStats` at the call
  site. `load()` is idempotent and race-safe (mirrors `authStore.restore()`'s
  synchronous check-then-set guard) and owns its own error handling end to
  end: a failure lands in `error` as a `RepoErrorCode`, never thrown past
  `load()`. `reset()` puts the store back to its pre-load shape — `boot.ts`'s
  only caller, before re-`load()`ing on a profile rebind, so a previous
  profile's rows are never shown even transiently under the new binding. `createMovimiento`/`updateMovimiento`/`deleteMovimiento`/
  `updateConfig` (`specs.md` §10.13) are the write path Wave 4 builds on, all
  sharing one `runMutation()`: a single `networkStore.canWrite()` check (the
  only place the offline policy is enforced), an optimistic apply in
  zustand's updater form so concurrent mutations can't clobber each other,
  the repo write, then the outbox enqueue — never the reverse, and each is
  its own failure domain: a repo failure rolls the store back and raises a
  Toast (`docs/error-handling.md` §7 — a store, not a form), while an
  enqueue failure never rolls back a repo write that already succeeded but
  raises its own `errors:sync.notQueued` Toast rather than staying silent.
  It never throws past the action, same contract as `load()`.
  `upsertCategoria`/`archiveCategoria`/`deleteCategoria` (`specs.md` §10.22)
  are the same convention applied to one `Categoria` inside `Config.categorias`:
  a shared `upsertById` helper merges by id from `state`/`get()` read fresh at
  the moment each step runs (never a value captured earlier), which is what
  keeps two categories created in the same tick from losing one to the
  other's stale array. `archiveCategoria` refuses (toast, no repo call) when
  it would leave zero non-archived categories; `deleteCategoria` refuses
  when any loaded `Movimiento` still references the id. Unlike `updateConfig`'s
  own `onSuccess` (a blind `set({ config: result })` — see `specs.md` §12 for
  the gap that leaves), these three re-merge their own field into the
  freshest `get().config` in `onSuccess` too, not just the optimistic apply —
  and their **rollback** does the same via a shared `revertOne` helper
  (restore the prior category, or drop it if this call created it), applied
  against `state.config` read fresh inside `set()` rather than a `previous`
  snapshot taken at the call's start. A snapshot-based rollback is safe only
  when concurrent writes settle in dispatch order; two categories created
  moments apart on real, independent network timing don't, and a slow
  failure's rollback restoring a stale snapshot would erase whatever a
  faster concurrent write already committed in between (`dataStore.test.ts`:
  "a slow failing upsert rolling back must not erase a concurrent one that
  already succeeded" — caught by review, `specs.md` §11, 2026-08-20).
- `hlc.ts` — a hybrid logical clock (`specs.md` §10.19). `tick()` yields a
  strictly increasing `Hlc`, encoded so two values compare correctly as
  plain strings. `observe(remote)`/`clampToServer(serverNow)` are the
  "hybrid" half — folding in a remote hlc so future ticks sort after it,
  and recovering from a poisoned local clock using Drive's response `Date`
  — filled in by Track Z (`sync/`), which is the first caller of either.
- `outbox.ts` — the append-only queue of operations not yet pushed to Drive
  (`specs.md` §10.13/§10.19) plus the `dirty` flag `sync/engine.ts`'s
  triggers read. Holds the op envelope (`hlc`, `basedOn`, `device`); stored
  in `db.ts`'s `outbox` table on whichever `ProfileDb` `setOutboxDatabase()`
  last pointed it at — `boot.ts`'s only caller, right after
  `repoProvider.bindActiveProfile()` (`specs.md` §10.25 addendum), so the
  outbox always tracks the same profile the repo does; starts on the frozen
  default `db` before the first boot. `enqueueOperation()` returns a
  `boolean`, not `void` — a storage failure reaches the caller instead of
  only a log (`docs/error-handling.md` §4), so a repo write that succeeded
  but never queued cannot pass for success. `basedOn` is the greater of
  this device's own outbox history and `sync/tip.ts`'s cache of what a pull
  last taught it — not outbox history alone, which is wrong the moment a
  pull exists (see `lastHlcFor`'s own comment for the traced bug).
  `observeRemoteHlc`/`clampOutboxClockToServer` expose the one clock
  instance this module owns to `sync/engine.ts`, since nothing else may
  mutate it directly.
- `repoProvider.ts` — the single swap point every screen reads through,
  never importing `repo.fake.ts`/`repo.local.ts` directly. `getRepo(): Repo`
  is synchronous and serves the binding `src/lib/boot.ts` establishes once
  at boot (`specs.md` §10.25/§10.28) — it throws (never falls back to the
  fake repo) if called before that binding exists, which every real call
  site can't do: they all render behind `BootGate`.
  `resolveActiveProfileBinding()` resolves the active profile, opens its
  database and returns `{ profile, database, repo }` together
  (`getActiveProfileRepo()` is a thin convenience wrapper around it for a
  caller that only wants the repo); `bindActiveProfile()`/
  `getActiveProfileBinding()` are the module-level binding `getRepo()`
  reads and `boot.ts` writes.
- `boot.ts` — the boot sequence (`specs.md` §10.28): `useBootStore.run()`
  resolves the active profile, binds it (`repoProvider.bindActiveProfile()`)
  and redirects the outbox to it (`outbox.setOutboxDatabase()`), resets and
  reloads `dataStore` on a genuine rebind (switching accounts — never on a
  same-profile repeat call, which is an idempotent no-op so navigating
  between top-level routes can't re-trigger a reload), then lands in
  `'ready'` or `'error'`. Its concurrency guard is a plain module variable,
  not the public `status` field — `status` only flips to `'running'` when a
  reload is actually about to happen, which is what lets
  `src/features/boot/BootGate.tsx` skip the brand screen entirely on a
  same-profile remount. That same `status` is a module-global singleton,
  though, so a stale `'ready'` left over from a _previous_ session is
  otherwise indistinguishable from "already ready for the profile this
  mount is about to resolve" — `invalidateBootForSignOut()` resets it back
  to `'idle'`, and `authStore.ts`'s `logout()` is its one caller (found and
  fixed during this track's own review, `specs.md` §11, 2026-08-20).
  Consumed by `BootGate`, own `README.md` there.
- `profiles/` — the device-scoped profile registry (`specs.md` §10.15). One
  dexie database per profile (via `db.ts`'s `createProfileDb()`); the
  registry itself lives in `deviceStore.ts`'s shared `kurobello-device`
  connection (its `profiles` table). `getActiveProfile()` resolves which one
  is active by recency, with no switcher UI yet. Own `README.md`.
- `repo.contract.ts` — shared `Repo` behavior every implementation must
  agree on (`testRepoContract()`), invoked from `repo.local.test.ts`,
  `repo.fake.test.ts`, and `repo.drive.test.ts` (`docs/error-handling.md`
  §6). A plain module, not a `*.test.ts` file, so vitest doesn't collect it
  as its own standalone suite.
- `export/` — CSV export of the user's movements (`specs.md` §10.12): pure
  serialisation (`csv.ts`) split from platform delivery (`delivery.ts`,
  `navigator.share` with a download-link fallback), orchestrated by
  `index.ts`'s `exportMovimientosToCsv()`. Reads through `getRepo()`; no UI
  trigger yet (`specs.md` §10.18 wires it in a later stage). Also the yearly
  compaction CSV's own implementation (`sync/engine.ts`'s `compactYear()`
  imports `csv.ts` directly — no second CSV module). Own `README.md`.
- `sync/` — the Drive sync engine (`specs.md` §10.19): op-log format,
  replay/merge, transport, sharding/compaction, and the "when it syncs"
  triggers. Own `README.md`.
