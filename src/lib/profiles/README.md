# src/lib/profiles

Device-scoped profile registry, owner marker, and switcher. One Dexie
database per profile (`src/lib/db.ts`'s `createProfileDb()`), not a
`profileId` column.

- `profileRegistry.ts` — `ProfileRecord` (`id`, `label`, `kind`: `'local'` |
  `'google'`, `databaseName`, `createdAt`, `lastUsedAt`, `accountKey?`,
  `driveFolderId?`, `lastPushAt?`, `lastPullAt?`) lives on
  `src/lib/deviceStore.ts`'s shared `kurobello-device` connection (`profiles`
  table), not a database of its own. `getActiveProfile()` consults an
  explicit active-profile pointer (`getActiveProfileId`/`setActiveProfileId`,
  the same connection's `activeProfile` table) first, falling back to
  recency. Lazily adopts the frozen `kurobello` database as the first
  profile if the registry is empty. `removeProfile(id)` never removes the
  default profile. `resolveGoogleProfile({ accountKey, label })` matches by
  `accountKey`, registers a profile if none matches. `makeProfileDatabaseName`
  mints `kurobello-<id>` for any non-default profile.
- `profileDb.ts` — one Dexie connection per database name, cached in a map.
  The default name resolves to `db.ts`'s `db` singleton rather than a second
  connection to the same IndexedDB database.
- `profileOwner.ts` — reads/writes the owner marker in each profile's own
  database (`db.ts`'s `profileOwner` table): `ensureOwnerMarker` writes once,
  idempotently; `readOwnerMarker` reads it back and does not self-catch.
- `switchProfile.ts` — `switchToProfile(target)`: no-ops if already active,
  checks the target's owner marker, sets the active-profile pointer, calls
  `useBootStore.getState().run()`, verifies the rebind landed against
  `getActiveProfileBinding()`, stops the old profile's sync triggers, and
  starts the new one's only if the target's `accountKey` matches the
  currently authenticated account. Not re-exported from `index.ts` (imports
  `authStore.ts`, which imports this barrel).
- `adoption.ts` — `countUnadoptedGuestMovements(targetDb)` diffs the
  local/guest profile's movement ids against `targetDb`'s; `adoptGuestMovements
  (target)` **copies** (only `Movimiento`, no `Activo`, never deletes from the
  guest db) whatever's missing into `target`'s database and outbox — a merge,
  idempotent, safe to re-run with nothing pending. The per-movement enqueue
  decision is gated on `deviceStore.ts`'s `adoptedMovements` table (keyed
  `${profileId}:${movimientoId}`, written only after `enqueueOperation`
  succeeds), not on whether the movement currently has a live outbox row —
  a successfully pushed op's outbox row is routinely removed by
  `sync/engine.ts`'s compaction, so using outbox presence as the guard would
  re-enqueue already-delivered movements on every later re-run.
  `finishConsentedAdoption(target)` runs the copy then clears the durable
  `adoptionConsent` marker (`deviceStore.ts`). `resumePendingAdoption
  (activeProfile)` is `boot.ts`'s fire-and-forget entry point: no-op if no
  consent is pending, or if the pending consent names a different profile
  id/account key than the one now active.
- `index.ts` — the public barrel: profile types, registry functions,
  `getProfileDatabase`, `ensureOwnerMarker`/`readOwnerMarker`,
  `adoptGuestMovements`/`countUnadoptedGuestMovements`/`finishConsentedAdoption`/
  `resumePendingAdoption`. Not `switchToProfile`.

Consumed by `src/lib/repoProvider.ts`'s `resolveActiveProfileBinding()`
(called once per boot by `src/lib/boot.ts`) and `src/lib/authStore.ts`. The
switcher UI is `src/features/profile/ProfilesSection.tsx`, through
`useProfiles.ts`; the repeatable Profile-screen entry point for adoption is
`src/features/profile/GuestAdoptionSection.tsx`, through
`useGuestAdoptionEntry.ts`.
