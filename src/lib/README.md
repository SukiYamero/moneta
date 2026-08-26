# src/lib

Shared stores, helpers, and the Drive/auth/lock logic layer. No UI here.

## Data contract

- `schema.ts` — the data-model contract (`Movimiento`, `Activo`, `Config`
  types + `SCHEMA_VERSION`). Import it, never redefine the types.
- `repo.ts` — the storage-agnostic `Repo` port (`Repo`, `CrudRepo`,
  `ListQuery`, `ListResult`, `RepoError`).
- `repo.local.ts` — the Dexie-backed `Repo` (`createLocalRepo()`): schema
  migration gate, generic `CrudRepo<T>` factory with keyset pagination.
- `repo.fake.ts` — in-memory `Repo` seeded with sample data
  (`createFakeRepo()`, and the `fakeRepo` singleton).
- `repo.drive.ts` — `createDriveRepo(database)`, a thin wrapper around
  `repo.local.ts`; the Drive sync itself lives in `sync/engine.ts`.
- `repo.contract.ts` — `testRepoContract()`, the shared behavior suite run
  against all three `Repo` implementations.
- `repoProvider.ts` — `getRepo()`, the single swap point every screen reads
  through. `resolveActiveProfileBinding()`/`bindActiveProfile()`/
  `getActiveProfileBinding()` manage the active profile's `{ profile,
  database, repo }` binding that `getRepo()` reads.
- `db.ts` — the Dexie (IndexedDB) instance/schema, and `createProfileDb(name)`,
  the factory behind every profile's own database (`db` is
  `createProfileDb('kurobello')`).
- `dataStore.ts` — zustand store holding `movimientos`/`activos`/`config` for
  the screens, plus `status`/`error`. `load()`/`reset()` and the
  `createMovimiento`/`updateMovimiento`/`deleteMovimiento`/`updateConfig`/
  `upsertCategoria`/`archiveCategoria`/`deleteCategoria` write path.
- `movimientoStats.ts` — pure derivation of every number Home/History/Search
  show, from `Movimiento[]`: `periodRange`, `filterByRange`, `totals`,
  `otherCurrencies`, `breakdownBy`, `series`, `toIsoDate`.
- `seedConfig.ts` — `buildSeedConfig(region, locale)`, the first-run `Config`
  seed (currency by region, section/category names by locale).

## Auth, lock, boot

- `auth.ts` — GIS token-client wrapper: identity scopes at login, Drive
  scopes requested incrementally.
- `authStore.ts` — zustand store wrapping `auth.ts`: session status
  (`idle`/`authenticating`/`authenticated`/`guest`/`error`),
  `login`/`restore`/`logout`/`continueAsGuest`/`hydrate`, Drive opt-in
  (`connectDrive`/`dismissDrive`), and guest-data adoption
  (`acceptGuestAdoption`/`declineGuestAdoption`). Exports
  `accountKeyOf(user)`.
- `pinLock.ts` — WebCrypto envelope encryption for the cached auth session
  (PIN + optional biometric via WebAuthn PRF): `enableLock`, `unlockWithPin`,
  `unlockWithBiometric`, `resetVault`, `updateSession`. Also owns the
  session-less guest lock (`enableGuestLock`/`disableGuestLock`/
  `hasGuestLock`/`verifyGuestLock`).
- `lockStore.ts` — zustand store wrapping `pinLock.ts`: lock phase, throttle,
  biometric availability, `onHidden`/`onVisible` background timeout,
  `lockKind: 'account' | 'guest' | null`, and the cold-start guest gate in
  `init()`.
- `deviceStore.ts` — a separate Dexie database (`kurobello-device`), the
  home for every non-secret, per-device signal: the login/guest-used
  markers, the Drive-sync decision, the active-profile pointer, the guest
  lock, the guest-adoption markers, and `sync/`'s `syncTips`/`syncFileCache`
  caches.
- `networkStore.ts` — zustand store owning the online/offline hint plus the
  offline write window. `canWrite(kind, now?)` is the single "may this write
  proceed?" answer.
- `boot.ts` — `useBootStore.run()`: resolves and binds the active profile,
  redirects the outbox to it, resets/reloads `dataStore` on a rebind.
  `invalidateBootForSignOut()` resets boot status on logout.
- `bootstrap.ts` — `bootstrap(token)`: idempotent Drive provisioning (folder,
  `LEEME.txt`, first-run `Config` seed).

## Cross-cutting

- `categoryIconKeys.ts` — `CATEGORY_ICON_KEYS`/`CategoryIconKey`, no
  `lucide-react` import (see `src/components/shared/categoryIcons.ts`).
- `iconAvatarTint.ts` — `ICON_AVATAR_TINTS`/`IconAvatarTint`.
- `branding.ts` — `APP_NAME`, the single source for the display name.
- `initials.ts` — `getInitials(name)`.
- `i18n/` — the translation table (`react-i18next`). Own `README.md`.
- `theme.ts` — pure `Preferencias['tema']` resolution: `systemTheme`,
  `resolveTheme`, `applyTheme`, `persistTheme`.
- `syncStoredTheme.ts` — the `dataStore` subscription that applies a
  resolved `tema` to the document and tracks `prefers-color-scheme` live.
- `errorCopy.ts` — `RepoErrorCode` → translation key.
- `toastStore.ts` — the global notification store behind `Toaster`:
  `toast.success`/`toast.error`, `setToastsSuppressed`.
- `landscapeGateStore.ts` — in-memory, unpersisted "skip the landscape
  gate this session" flag.
- `swUpdate.ts` — service-worker update lifecycle:
  `createSwUpdateController(registerSW)`, `initServiceWorkerUpdates()`,
  `applyServiceWorkerUpdate()`.
- `utils.ts` — `cn()`, the Tailwind class-merge helper.
- `weekStart.ts` — `Preferencias.primerDiaSemana` (`0 | 1`) ↔
  `'sunday' | 'monday'` mapping, both directions.
- `hlc.ts` — `createLogicalClock(device)`, a hybrid logical clock: `tick`,
  `observe`, `clampToServer`.
- `outbox.ts` — the append-only queue of operations not yet pushed to Drive,
  plus the `dirty` flag `sync/engine.ts`'s triggers read.
  `enqueueOperation`/`listPendingOperations`/`removeOperations` take an
  optional `database: ProfileDb` for `sync/engine.ts`'s pull/push, which
  must keep operating on the profile they started with even if the active
  binding changes mid-flight.
- `profiles/` — the device-scoped profile registry, owner marker, and
  switcher. Own `README.md`.
- `export/` — CSV export of the user's movements. Own `README.md`.
- `sync/` — the Drive sync engine: op-log format, replay/merge, transport,
  sharding/compaction, and the sync triggers. Own `README.md`.
