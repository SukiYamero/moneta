# src/lib/profiles

Device-scoped profile registry (`specs.md` §10.15): local data belongs to
_someone_. One dexie database per profile, not a `profileId` column — see
`src/lib/db.ts`'s `createProfileDb()`, the factory this module builds on.

- `profileRegistry.ts` — a separate, tiny Dexie database
  (`kurobello-profiles`, distinct from a profile's own `db.ts` database)
  listing profiles: `id`, `label`, `kind` (`local` | `google`),
  `databaseName`, `createdAt`, `lastUsedAt`. `getActiveProfile()` lazily
  adopts the frozen `kurobello` database as the first profile on a device
  that has never written a registry row, then returns whichever profile was
  used most recently — there is no switcher UI yet (Wave 5+), so recency is
  the only signal available. Every read self-catches and degrades to "no
  signal recorded" (empty list / `undefined`), same posture as
  `src/lib/deviceStore.ts`: storage trouble may suppress a convenience, must
  never block boot. `makeProfileDatabaseName(id)` mints a `kurobello-<id>`
  suffix for any profile beyond the adopted default — the frozen
  `kurobello` base itself is never renamed (`AGENTS.md`).
- `profileDb.ts` — one Dexie connection per database name, cached across
  calls. The default name resolves to `db.ts`'s exact `db` singleton
  (not a second connection to the same IndexedDB database), so every
  existing caller of `db` keeps sharing that one connection and its
  `ready()` memo.
- `index.ts` — the public barrel: profile types, the registry functions, and
  `getProfileDatabase()`.

Consumed by `src/lib/repoProvider.ts`'s `getActiveProfileRepo()` — proven
with tests, not yet wired into `getRepo()` (the stub flip is gated on Wave
4's create UI, `specs.md` "Wave 3 — staging and dependencies"). No UI reads
this module yet; `specs.md` §10.18 renders a read-only profile list in
stage 3.
