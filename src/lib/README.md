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
  biometric availability (`biometricAvailable` — platform capability — vs
  `biometricEnrolled` — this vault's own enrollment, see `specs.md` §11,
  2026-08-19).
- `loginMarker.ts` — a separate, tiny Dexie database (`kurobello-device`,
  distinct from `db.ts`'s `kurobello`) holding one non-secret, per-device
  signal: "has a Google login ever succeeded here." Gates
  `authStore.restore()`'s silent re-auth so it can tell a returning user
  apart from a first-ever visit or a just-locked-out device (`specs.md` §11,
  2026-08-19).
- `toastStore.ts` — the global notification store behind `Toaster`:
  `toast.success(message)` / `toast.error(message)`, callable from anywhere
  with no provider. Holds no domain state and reads no other store
  (`specs.md` §10.6) — `setToastsSuppressed(boolean)` is a domain-free flag
  `AppLock` drives from the lock phase, so the dependency points policy →
  surface and nothing that merely raises a toast pulls in WebCrypto/Dexie.
  Stack capped at 3, one independent timer per card (4s success / 7s error),
  identical re-raises collapse instead of stacking. Suppressing also clears
  what is already on screen, so nothing can resurface after an unlock.
  Callers pass already-localized copy; it never renders a raw
  `error.message` (`docs/error-handling.md` §5/§7).
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
  `load()`.
- `repoProvider.ts` — the single swap point: `getRepo()` returns the shared
  fake `Repo` today. `// STUB(wave3)` marks the one line to change once a
  Drive-backed `Repo` exists (`specs.md` §12).
- `repo.contract.ts` — shared `Repo` behavior every implementation must
  agree on (`testRepoContract()`), invoked from both `repo.local.test.ts`
  and `repo.fake.test.ts` (`docs/error-handling.md` §6). A plain module, not
  a `*.test.ts` file, so vitest doesn't collect it as its own standalone
  suite.
