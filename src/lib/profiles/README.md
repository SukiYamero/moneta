# src/lib/profiles

Device-scoped profile registry, owner marker, and switcher (`specs.md`
§10.15, §10.31): local data belongs to _someone_, and a person can move
between the profiles on their device deliberately. One dexie database per
profile, not a `profileId` column — see `src/lib/db.ts`'s
`createProfileDb()`, the factory this module builds on.

- `profileRegistry.ts` — lists profiles (`id`, `label`, `kind` (`local` |
  `google`), `databaseName`, `createdAt`, `lastUsedAt`, and now `accountKey`)
  on `src/lib/deviceStore.ts`'s shared `kurobello-device` connection (its
  `profiles` table), not a database of its own and not a profile's own
  `db.ts` database. `getActiveProfile()` consults an **explicit
  active-profile pointer** first (`getActiveProfileId`/`setActiveProfileId`,
  the same connection's `activeProfile` table, `specs.md` §10.31 §1) —
  falling back to recency only for a device that has never made an explicit
  choice (or whose pointer names a since-removed profile). It also lazily
  adopts the frozen `kurobello` database as the first profile on a device
  that has never written a registry row. `removeProfile(id)` deletes a
  registry row (never the frozen default) and clears a pointer aimed at it
  — the answer to "the registry lists a profile whose database is gone"
  (`switchProfile.ts`'s own edge case below). Every read self-catches and
  degrades to "no signal recorded" (empty list / `undefined`), same posture
  as `src/lib/deviceStore.ts`: storage trouble may suppress a convenience,
  must never block boot. `makeProfileDatabaseName(id)` mints a
  `kurobello-<id>` suffix for any profile beyond the adopted default — the
  frozen `kurobello` base itself is never renamed (`AGENTS.md`).
  `accountKey?: string` (`specs.md` §10.20) records _whose_ a `'google'`
  profile is (the userinfo email `authStore.ts` already fetches), not only
  what kind it is — `undefined` for `'local'`/guest, and for any profile
  that predates the field (none: `registerProfile()` had no production
  caller before this). `resolveGoogleProfile({ accountKey, label })` is the
  one write path that sets it: matched by `accountKey` (never `label` — a
  display name can repeat or change), it touches the matching profile's
  recency or registers a fresh one, called from `authStore.ts` on every
  `login()`/`restore()`/`hydrate()` success. `authStore.ts`'s
  `syncProfileForAccount` also sets the explicit active-profile pointer to
  whatever this resolves — the actual fix for "signing back into a
  previously-used account returns you to it" (`specs.md` §10.31 §1
  superseded the older, recency-only version of this same claim).
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
- `profileOwner.ts` — reads/writes the owner marker `db.ts`'s `v4` adds
  (`specs.md` §10.31 §2): `ensureOwnerMarker(database, { kind, accountKey,
createdAt })` writes only if the database doesn't already carry one
  (idempotent — `repoProvider.ts` calls it on every bind), `readOwnerMarker
(database)` reads it back. Its own module rather than folded into
  `profileDb.ts`/`profileRegistry.ts` — it only imports `@/lib/db`'s types,
  so neither of those two (which already import each other's exports at
  their own top level) risks a value-level import cycle by also depending
  on this one. `switchProfile.ts` reads this marker as its "is the target's
  database actually there" check.
- `switchProfile.ts` — `switchToProfile(target)` (`specs.md` §10.31): no
  PIN (decided by the user — the PIN gates opening the app, not moving
  inside it), no new rebind path (`src/lib/boot.ts`'s `run()` is reused
  exactly as sign-out + sign-in-as-a-different-account already reuses it).
  Order: no-op if `target` is already active → pre-check the target's owner
  marker (absent means its storage was cleared — returns
  `'profile-database-gone'` without touching anything) → set the explicit
  pointer → `useBootStore.getState().run()` → stop the old profile's sync
  triggers unconditionally → start the new one's only if it belongs to the
  currently authenticated account (`authStore.ts`'s `accountKeyOf`,
  `specs.md` §10.31 §4 — switching to a Google profile you are not signed
  into shows its local data with sync off, on purpose). Composed **above**
  `boot.ts`, `authStore.ts` and `sync/syncSession.ts` rather than inside
  any one of them: `authStore.ts` already imports `boot.ts`
  (`invalidateBootForSignOut`), and `syncSession.ts` already imports
  `authStore.ts` — `boot.ts` importing `syncSession.ts` directly would
  close that into a cycle. Deliberately **not** re-exported from `index.ts`
  for the identical reason one level up: it imports `authStore.ts`, which
  imports this barrel — callers import it directly from `@/lib/profiles/
switchProfile`.
- `adoption.ts` — `countGuestMovements()` / `adoptGuestMovements(target)`
  (`specs.md` §10.32): the local/guest profile (always `db.ts`'s frozen
  `kurobello` — a guest never has any other database) is the only source;
  movements only, no `Activo` (there is no sync write path for it yet —
  `outbox.ts`'s `OutboxOperation` union has no variant, so there is nothing
  to enqueue even if it were copied). `adoptGuestMovements` is a merge, not
  a replace (ids are `crypto.randomUUID()`, so nothing in `target` can
  collide) and **resumable by construction, not by tracking progress**:
  every step is an idempotent "set" operation over data re-read fresh each
  call (`bulkPut` into the target, a guarded enqueue that skips an entity
  id already queued, then `bulkDelete` from the source) — IndexedDB has no
  transaction spanning two separate databases, so a caller safe to retry
  after _any_ interruption (a tab closed mid-move) by simply calling this
  again, no special "resume" argument, is what stands in for atomicity.
  Written test-first (`adoption.test.ts`'s interruption test mocks a
  mid-move failure, asserts neither side lost data, then retries and
  asserts the retry finishes cleanly with no duplicate outbox entries).
  Throws on failure rather than swallowing it — the caller
  (`authStore.ts`'s `acceptGuestAdoption`) decides whether/when to retry.
- `index.ts` — the public barrel: profile types, the registry functions
  (including the active-profile pointer and `removeProfile`), and
  `getProfileDatabase()`/`ensureOwnerMarker`/`readOwnerMarker`/
  `adoptGuestMovements`/`countGuestMovements`. Not `switchToProfile` — see
  `switchProfile.ts`'s own entry above.

Consumed by `src/lib/repoProvider.ts`'s `resolveActiveProfileBinding()`,
called once per boot by `src/lib/boot.ts` (`specs.md` §10.28) — its result is
what `getRepo()` now serves (the flip, `specs.md` §10.25). Also consumed by
`src/lib/authStore.ts`: `resolveGoogleProfile` + `setActiveProfileId`
(`specs.md` §10.20, §10.31 §1) — every `login()`/`restore()`/`hydrate()`
success resolves the signed-in account's profile and pins the pointer to
it, self-catching so a registry failure never fails the auth flow it rides
on, and (for `login()`/`restore()`'s online branch) resolved _before_
`status` flips to `'authenticated'`, so `boot.ts` can never read the
registry ahead of it — and `setActiveProfileId(DEFAULT_PROFILE_ID)` from
`continueAsGuest()`, so a guest can't land in whatever Google account was
last signed out of. The switcher UI is
`src/features/profile/ProfilesSection.tsx` (`specs.md` §10.18/§10.31),
through `useProfiles.ts`.
