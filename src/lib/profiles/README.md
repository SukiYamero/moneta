# src/lib/profiles

Device-scoped profile registry (`specs.md` §10.15): local data belongs to
_someone_. One dexie database per profile, not a `profileId` column — see
`src/lib/db.ts`'s `createProfileDb()`, the factory this module builds on.

- `profileRegistry.ts` — lists profiles (`id`, `label`, `kind` (`local` |
  `google`), `databaseName`, `createdAt`, `lastUsedAt`, and now `accountKey`)
  on `src/lib/deviceStore.ts`'s shared `kurobello-device` connection (its
  `profiles` table), not a database of its own and not a profile's own
  `db.ts` database. `getActiveProfile()` lazily adopts the frozen
  `kurobello` database as the first profile on a device that has never
  written a registry row, then returns whichever profile was used most
  recently — there is no switcher UI yet (Wave 5+), so recency is the only
  signal available. Every read self-catches and degrades to "no signal
  recorded" (empty list / `undefined`), same posture as
  `src/lib/deviceStore.ts`: storage trouble may suppress a convenience, must
  never block boot. `makeProfileDatabaseName(id)` mints a `kurobello-<id>`
  suffix for any profile beyond the adopted default — the frozen
  `kurobello` base itself is never renamed (`AGENTS.md`).
  `accountKey?: string` (`specs.md` §10.20) records _whose_ a `'google'`
  profile is (the userinfo email `authStore.ts` already fetches), not only
  what kind it is — `undefined` for `'local'`/guest, and for any profile
  that predates the field (none: `registerProfile()` had no production
  caller before this). `resolveGoogleProfile({ accountKey, label })` is the
  one write path that sets it: matched by `accountKey` (never `label` — a
  display name can repeat or change), it touches the matching profile's
  recency or registers a fresh one, called from `authStore.ts` on every
  `login()`/`restore()`/`hydrate()` success. This is what makes
  `getActiveProfile()`'s existing pure-recency resolution identity-aware
  without changing that function at all — whichever account just
  established a session is, by construction, the most-recently-touched
  profile, so signing back into a previously-used account resolves to it
  again instead of to whatever else was touched last.
  `driveFolderId?: string` / `lastPushAt?: string` / `lastPullAt?: string`
  (`specs.md` §10.19) are the sync watermark: "is this profile linked to
  Drive" is `driveFolderId !== undefined` (set once `bootstrap.ts` resolves
  the KuroBello folder — not `kind === 'google'`, since §5's incremental
  authorization means signing in and granting Drive access are separate
  consents), and "has it ever synced" / "is it up to date" derive from
  `lastPullAt`/`lastPushAt` rather than a stored `isSynced` flag that could
  drift from reality. Written only by `src/lib/sync/engine.ts`
  (`setDriveFolderId`/`recordSuccessfulPush`/`recordSuccessfulPull`), not
  self-catching — same posture as `resolveGoogleProfile`: a caller
  recording a sync result needs to know if the write didn't land.
- `profileDb.ts` — one Dexie connection per database name, cached across
  calls. The default name resolves to `db.ts`'s exact `db` singleton
  (not a second connection to the same IndexedDB database), so every
  existing caller of `db` keeps sharing that one connection and its
  `ready()` memo.
- `index.ts` — the public barrel: profile types, the registry functions, and
  `getProfileDatabase()`.

Consumed by `src/lib/repoProvider.ts`'s `getActiveProfileRepo()` — proven
with tests, not yet wired into `getRepo()` (the stub flip is gated on Wave
4's create UI, `specs.md` "Wave 3 — staging and dependencies") — and by
`src/lib/authStore.ts` (`resolveGoogleProfile`, `specs.md` §10.20), which
is live: every `login()`/`restore()`/`hydrate()` success resolves the
signed-in account's profile, self-catching so a registry failure never
fails the auth flow it rides on. No UI writes through this module yet;
`specs.md` §10.18 renders a read-only profile list in stage 3
(`src/features/profile/ProfilesSection.tsx`).
