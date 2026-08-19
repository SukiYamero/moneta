# src/lib

Shared stores, helpers, and the Drive/auth/lock logic layer. No UI here.

- `schema.ts` — the data-model contract (`Movimiento`, `Activo`, `Config`
  types + `SCHEMA_VERSION`). Import it, never redefine the types.
- `branding.ts` — `APP_NAME`, the single source for the display name.
- `auth.ts` — GIS token-client wrapper: identity scopes at login, Drive
  scopes requested incrementally via `connectDrive`.
- `authStore.ts` — zustand store wrapping `auth.ts`; owns session status and
  triggers `bootstrap.ts` through `connectDrive`.
- `drive.ts` — thin Drive REST client (find/create files & folders).
- `bootstrap.ts` — idempotent provisioning of the `KuroBello` folder + the
  three JSON data files.
- `db.ts` — the Dexie (IndexedDB) instance. `v1` has the `LockVault` table;
  `v2` additively adds `movimientos`, `activos`, and a single-row `config`
  table (indexes chosen to serve `Repo`'s `ListQuery` — see the comment
  above `db.version(2)`).
- `pinLock.ts` — WebCrypto envelope encryption for the cached token
  (PIN + optional biometric via WebAuthn PRF).
- `lockStore.ts` — zustand store wrapping `pinLock.ts`: lock phase, throttle,
  biometric availability.
- `utils.ts` — `cn()`, the Tailwind class-merge helper.
- `repo.ts` — the storage-agnostic `Repo` port contract (`Repo`, `CrudRepo`,
  `ListQuery`, `ListResult`, `RepoError`). Frozen shape — additive changes
  only (see `specs.md` §10.3/§11).
- `repo.local.ts` — the real dexie-backed `Repo` implementation
  (`createLocalRepo()`): schemaVersion seeding/migration gate, generic
  `CrudRepo<T>` factory (shared by `movimientos`/`activos`) with keyset
  pagination, write validation, and atomic bulk paths. Tests in
  `repo.local.test.ts`. The Drive-backed implementation is a future sibling
  file behind the same port.
- `repo.fake.ts` — in-memory `Repo` implementation, seeded with deterministic
  Spanish sample data (`createFakeRepo()` for an isolated instance, the
  `fakeRepo` singleton for app code — see `specs.md` §10.5).
