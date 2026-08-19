# Track V — report (local data scoping / profiles)

## What was built and why

`specs.md` §10.15's model — one dexie **database per profile**, not a
`profileId` column — was already decided; this track wired it up without
touching a screen, `dataStore`, or `schema.ts`.

1. **`src/lib/db.ts` parameterised.** `createProfileDb(name: string): ProfileDb`
   builds the identical vault/movimientos/activos/config schema against any
   Dexie database name. `export const db = createProfileDb('kurobello')`
   keeps the frozen instance byte-for-byte the same object every existing
   importer (`pinLock.ts`, `repo.local.ts`'s default, every test) already
   depends on — nothing that imports `db` today changes behavior.

2. **`src/lib/repo.local.ts` parameterised.** `createLocalRepo(database:
ProfileDb = db)` closes over the passed database instead of the module
   singleton. The `readyPromises` WeakMap is now keyed by `ProfileDb`
   (previously `typeof db`, which was already effectively one fixed value) —
   confirmed by test, not assumed, that two repos on two different databases
   run `performReady()` independently and two repos on the _same_ database
   still share one in-flight memo. `createCrudRepo` and the `add`/`update`/
   `remove`/`removeMany` transactions now use the passed `database`, not the
   module `db`, for every dexie call.

3. **`src/lib/profiles/` (new folder).**
   - `profileRegistry.ts` — a separate, tiny Dexie database
     (`kurobello-profiles`) listing profiles: `id`, `label`, `kind` (`local`
     | `google`), `databaseName`, `createdAt`, `lastUsedAt`.
     `getActiveProfile()` lazily adopts the frozen `kurobello` database as
     the first profile on first read, then returns the most-recently-used
     row. Every read self-catches and degrades to "no signal" (empty
     list / `undefined`), matching `deviceStore.ts`'s posture. `registerProfile`
     does **not** self-catch — a caller asking to register a profile needs
     to know if it failed. `makeProfileDatabaseName(id)` mints
     `kurobello-<id>`, the only place a new database name is minted.
   - `profileDb.ts` — one cached Dexie connection per database name; the
     default name resolves to `db.ts`'s exact `db` singleton, not a second
     connection to the same IndexedDB database.
   - `index.ts` — the public barrel.
   - `README.md` — the new-directory doc (per `AGENTS.md`).

4. **`src/lib/repoProvider.ts`.** `getRepo()` is byte-for-byte unchanged —
   still returns `fakeRepo`. A new `getActiveProfileRepo(): Promise<Repo>`
   resolves the active profile, touches its `lastUsedAt`, opens its
   database, and returns a `createLocalRepo()` scoped to it. It is built,
   exported, and proven with tests, but **nothing calls it** — the stub
   stays a stub, per the brief and `specs.md`'s explicit sequencing note.

## A real bug the TDD process caught (not in the original brief)

`getActiveProfile()`'s "most recent wins" comparison used ISO-string
`lastUsedAt` timestamps at millisecond resolution. Two `touchLastUsed()`
calls issued back-to-back (which my own cross-profile isolation test does)
can land in the same millisecond under `fake-indexeddb` — observed directly:
the first 10-run flake check failed 1/5 times before the fix, 0/10 after.
Fixed by making `registerProfile`/`touchLastUsed` read the whole table and
compute a timestamp strictly greater than every existing `lastUsedAt`
(`nextLastUsedAt`, bumping by 1ms if wall time ties), inside the same
atomic read-then-write transaction pattern `repo.local.ts`'s `update()`/
`remove()` already use for the identical reason (`specs.md` §11,
2026-08-18). This is exactly the kind of thing `docs/error-handling.md` §4
warns about — a success-shaped return (an arbitrary, non-deterministic pick
on a tie) standing in for a real invariant violation — just in a new module,
not one of the six original cases.

## Decisions for `specs.md` §11

- **Database naming scheme:** the frozen `kurobello` database is adopted,
  unchanged, as the first ("default") profile. Every additional profile's
  database is named `kurobello-<profileId>` via `makeProfileDatabaseName()`
  — a suffix on the frozen base, never a rename of it, per `AGENTS.md` and
  Wave 3 plan §1.8.
- **Registry shape:** a separate device-scoped Dexie database
  (`kurobello-profiles`, one table `profiles`), not a table inside a
  profile's own `db.ts` database and not a table added to
  `deviceStore.ts`'s `kurobello-device` (that file is unowned this stage —
  no track's ownership row lists it, so it was left untouched). Row shape:
  `{ id, label, kind: 'local' | 'google', databaseName, createdAt,
lastUsedAt }`. `lastUsedAt` is kept as an ISO string (matches
  `Movimiento.createdAt`'s convention) but is now written through a
  monotonic-safe helper rather than raw `Date.now()` — see the bug above.
- **Active-profile selection before any UI exists:** recency.
  `getActiveProfile()` returns whichever registered profile has the highest
  `lastUsedAt`, lazily seeding the registry with the adopted `kurobello`
  profile on a device that has never written one. There is no persisted
  "this one is explicitly active" flag distinct from recency — Wave 5+'s
  switcher can add one if "reopen where you left off" ever needs to differ
  from "most recently touched," but nothing today needs that distinction.
- **`getActiveProfileRepo()` touches `lastUsedAt` on every call**, not just
  on an explicit switch. This keeps "most recently used" meaningful for a
  future switcher without that switcher having to remember to call
  `touchLastUsed` itself — the read path already knows when a profile was
  actually used.

## Backlog / deferred (for `specs.md` §12)

- The `repoProvider.getRepo()` stub flip itself — unchanged, gated on Wave
  4's create UI per the existing backlog entry. Nothing added here.
- No profile switcher, rename, delete, or consolidation-by-`id`-union — all
  explicitly out of scope per the brief and `specs.md` §10.15, and none of
  it was built.
- `getActiveProfile()`'s "most recent wins" policy has no tie-breaking need
  for _concurrent devices_ (each device has its own registry — recency is
  compared only among profiles local to one device), but if Wave 5+ ever
  syncs the registry itself across devices, the monotonic-timestamp fix
  above would need revisiting under real clock skew, not just same-tick
  ties on one device.

## Doc lines to add (`src/lib/README.md`, operator-owned — verify against

current code before applying, per the review protocol)

Insert after the existing `db.ts` bullet, before the `pinLock.ts` bullet:

```markdown
- `db.ts` — the Dexie (IndexedDB) instance. `v1` has the `LockVault` table;
  `v2` additively adds `movimientos`, `activos`, and a single-row `config`
  table (indexes chosen to serve `Repo`'s `ListQuery` — see the comment
  above `db.version(2)`). `createProfileDb(name)` is the factory behind it
  (`specs.md` §10.15): `db` is `createProfileDb('kurobello')`, the frozen
  first profile: every additional profile calls the same factory against a
  suffixed name via `src/lib/profiles/`.
```

Insert after the existing `repo.local.ts` bullet:

```markdown
- `src/lib/profiles/` — the device-scoped profile registry (`specs.md`
  §10.15). One dexie database per profile; `getActiveProfile()` resolves
  which one is active by recency, no switcher UI yet. Own `README.md`.
```

Amend the existing `repoProvider.ts` bullet (append a sentence):

```markdown
- `repoProvider.ts` — the single swap point: `getRepo()` returns the shared
  fake `Repo` today. `// STUB(wave3)` marks the one line to change once a
  Drive-backed `Repo` exists (`specs.md` §12). `getActiveProfileRepo()`
  builds the real per-profile-scoped repo and is fully tested, but nothing
  calls it yet — the stub flip is gated on Wave 4's create UI.
```

## Spec deltas — where the brief/§10.15 turned out to need clarification

None found that required a spec change. §10.15's "Done when" bullets — a
guest and signed-in account isolated, `kurobello` reachable as the first
profile with no migration, `getRepo()` unchanged — all hold as tested. The
only thing not explicit in either the brief or §10.15 was _how_ "active" is
selected pre-UI; resolved above as a §11 decision (recency), which is a
reasonable reading of "same pattern deviceStore.ts already uses," not a
correction to the spec.

## Open questions for the operator

- `getActiveProfileRepo()` calls `touchLastUsed()` on every resolution
  (including read-only usage). If a future caller wants to distinguish "the
  active profile" from "the profile last used," that's a real product
  question for whoever builds the Wave 5+ switcher, not something to guess
  at now.
- The profile registry (`kurobello-profiles`) is currently unbounded — no
  code path deletes a row (deletion is explicitly out of scope this wave).
  Not a problem at any realistic scale (a handful of profiles per device),
  flagging only because nothing enforces it.

## `bun run check` — real output

Two full clean runs, both green (`src/router.kit*.test.tsx` failed once
under heavy parallel load in an earlier run — confirmed unrelated to this
track: those files are Track U's `/kit` route, untouched here, and passed
both in isolation and on immediate re-run of the full suite):

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-v

 Test Files  77 passed (77)
      Tests  724 passed (724)
   Start at  14:55:31
   Duration  15.32s (transform 2.23s, setup 14.84s, import 45.23s, tests 19.44s, environment 42.54s)
```

(700 tests at the starting commit → 724 now: +24 from this track, across
`db.test.ts`, `repo.local.test.ts`'s new `createLocalRepo(database)`
describe block, `repoProvider.test.ts`'s new `getActiveProfileRepo()`
describe block, and the two new `src/lib/profiles/*.test.ts` files. The
pre-existing warning on `button.tsx` is unrelated to this track.)
