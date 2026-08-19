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
- `db.ts` — the Dexie (IndexedDB) instance, currently just the `LockVault`
  table.
- `pinLock.ts` — WebCrypto envelope encryption for the cached token
  (PIN + optional biometric via WebAuthn PRF).
- `lockStore.ts` — zustand store wrapping `pinLock.ts`: lock phase, throttle,
  biometric availability.
- `utils.ts` — `cn()`, the Tailwind class-merge helper.
- `repo.ts` — the storage-agnostic `Repo` port (**interface only for now** —
  see `specs.md` §10.3). Implementations (local dexie, Drive-backed) land
  per `specs.md` §12, Track A.
- `repo.fake.ts` — in-memory `Repo` implementation, seeded with deterministic
  Spanish sample data (`createFakeRepo()` for an isolated instance, the
  `fakeRepo` singleton for app code — see `specs.md` §10.5).
