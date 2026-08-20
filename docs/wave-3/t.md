# Track T — report

## What was built, and why

**The write convention (`src/lib/dataStore.ts`).** Four mutation actions —
`createMovimiento`, `updateMovimiento`, `deleteMovimiento`, `updateConfig` —
share one internal helper, `runMutation()`. Every mutation:

1. Consults `networkStore.canWrite(kind)` exactly once. Refused ⇒ a Toast
   with the refusal copy Track R wrote and left unconsumed
   (`errors:offline.mutationRestricted` / `errors:offline.windowExpired.title`)
   and nothing else touched — no repo call, no state change, no outbox entry.
2. **Applies optimistically** — the store updates before the repo confirms.
   Chosen over pessimistic (await-then-set) because the write convention has
   to serve every future `Repo` implementation behind the same port, not just
   today's near-instant local dexie/in-memory ones — the Drive-backed `Repo`
   §10.19 describes will have real latency, and a convention that only feels
   snappy against a fast implementation isn't the one convention this track
   was asked to build.
3. Awaits the repo call. **On success**, reconciles the store with the
   repo's own returned record (not just the optimistic patch) and enqueues
   an outbox operation built from that same authoritative result.
4. **On failure**, rolls the store back and raises a Toast keyed off the
   `RepoErrorCode`, reusing the exact copy the three read screens already
   show (`src/lib/errorCopy.ts`'s codes, via a small local
   `Record<RepoErrorCode, ToastMessageKey>` — see "Spec deltas" below for why
   this wasn't added to `errorCopy.ts` itself). Never inline: per
   `docs/error-handling.md` §7, "anything raised from a store rather than a
   form" is a Toast, and these are store actions with no form to write
   inline copy next to. The action never throws past itself, matching
   `load()`'s existing contract.

**Rollback is an inverse transform, not a snapshot restore.** Every
optimistic apply and its rollback are both expressed with zustand's updater
form (`set((state) => …)`), reading fresh state at the moment each runs, and
rollback undoes exactly its own mutation (remove-by-id, restore-the-one-item,
restore-the-one-config) rather than replacing the whole array/object with a
snapshot taken at the start. A snapshot-restore rollback would silently
erase an unrelated concurrent mutation that landed in between; the inverse-
transform approach doesn't, and "two concurrent creates, one fails" is
tested for exactly this (`useDataStore — concurrent mutations`).

**Repo-vs-outbox ordering: repo first, always.** The repo write is what the
user's screen shows; the outbox is invisible infrastructure. A change the
user is already looking at must never depend on a second, independent write
succeeding — so the outbox append happens only after the repo confirms, and
`enqueueOperation()` is itself unable to throw (self-catching, see below), so
it can safely sit inside the same `try` as the repo call without an outbox
hiccup ever triggering a rollback of a write that actually succeeded. The
alternative (outbox-then-repo) risks queuing an operation for a repo write
that never happens — a phantom entry a future flush would push for data the
user never actually got. Repo-then-outbox instead risks a row that's correct
and visible locally forever but never syncs — worse for the sync feature,
never worse for the user, and the only failure mode this track can actually
introduce (a local dexie/in-memory write failing is rare; see below).

**No success Toast from `dataStore`.** §10.6/§10.13 name error surfacing as
the reason the Toast exists; nothing in the brief requires success
confirmation from the store layer, and the codebase has no real "movement
saved" copy yet (`toast:demo.saved` is Kit-demo scratch, not production
copy — see "Spec deltas"). Left for whichever Wave 4 screen wants it, with
its own namespace-appropriate key, rather than minting speculative generic
copy now. Flagged as an open question below in case the operator wants this
decided the other way.

**`src/lib/hlc.ts` (new).** A hybrid logical clock, purely local:
`createLogicalClock(device, now?)` returns `{ tick() }`. Physical time
(`now()`, injectable) combined with a counter that only advances within the
same millisecond or on a backward clock jump, encoded as a zero-padded
base36 string (`millis-counter-device`) so two `Hlc` values compare
correctly with plain string comparison — no parsing needed anywhere that
reads the op log. Deliberately has **no** "observe a remote clock value" —
this device only ever writes its own file (§10.19: "exactly one device ever
writes any given file"), so it never needs to advance past a value it didn't
itself produce; that half of a "real" HLC belongs to whoever builds replay
(see "Spec deltas").

**`src/lib/outbox.ts` (new).** The local, append-only record of operations
not yet pushed, plus `useOutboxStore`'s `dirty` flag for a future flush
trigger to read. `enqueueOperation(operation)` stamps the whole envelope
itself (`hlc`, `basedOn`, `device`) so every caller produces an identically-
shaped entry — `dataStore.ts` never touches `hlc.ts` or `deviceStore.ts`
directly. `basedOn` is resolved from this device's own prior outbox entries
for the same entity id (`null` for a never-seen id). Storage: a new,
dedicated database, `kurobello-outbox` (table `entries: 'id, hlc,
[entity+entityId]'`), not a table on `db.ts`'s per-profile `ProfileDb` — the
outbox is sync bookkeeping, not domain data, and `db.ts` is outside this
track's blast radius. `listPendingOperations()` (hlc-ordered) and
`removeOperations(ids)` exist for Track Z's flush to call; nothing calls
either yet, deliberately — same posture as the Toast shipping a wave before
its first caller. Every read/write here self-catches and logs, never
throws — by the time `enqueueOperation` runs, the caller's repo write has
already succeeded and the user has already seen the result, so a queueing
failure can only ever cost a future sync, matching the fail-open posture
every other device-local write in this codebase already uses
(`deviceStore.ts`, `networkStore.ts`'s anchor).

**`src/lib/networkStore.ts` — offline policy reconciled.**
`MUTATION_ALLOWED_OFFLINE.delete` flipped `false → true` (specs.md §11,
2026-08-19: deleting is now allowed offline, superseding half of §10.11's
original restriction — a delete is terminal, so it commutes the same way an
append does). `edit`/`settings` are unchanged (still refused offline,
unconditionally). **Judgment call, not dictated word-for-word by the spec:**
the 7-hour window now gates `delete` exactly the way it already gated
`create` — both are the mutations the live-connectivity gate lets through,
and the window's own rationale (bounding how long a device may act on stale
session validity before being asked to reconnect) was never conceptually
scoped to "append specifically"; it only ever gated create alone because
create was the only thing allowed offline before this decision. Recorded as
an explicit decision below; flagged as an open question in case the operator
intended delete to be window-exempt.

**`src/lib/deviceStore.ts` — device id added.** `deviceDb` bumped to `v4`
(additive: `deviceId: 'id'`), holding one short (8-char, lowercase base36)
id minted once via `crypto.getRandomValues` and cached for the process
lifetime (`getDeviceId()`, promise-memoized). Kept on the same
`kurobello-device` connection as every other device signal, per that file's
own established pattern — not a fifth separate database.

## Decisions made (for specs.md §11)

- **Write convention: optimistic apply, repo-before-outbox, rollback on
  failure via an inverse transform (not a snapshot restore), Toast-only
  error surfacing, no store-level success Toast.** Full reasoning above.
  Applies to `createMovimiento`/`updateMovimiento`/`deleteMovimiento`/
  `updateConfig` uniformly — one convention, per §10.13's own goal.
- **The 7-hour offline write window now also gates `delete`, not just
  `create`.** `src/lib/networkStore.ts`'s `canWrite()`; a reconciliation of
  the 2026-08-19 "deleting is allowed offline" decision, not itself a prior
  decision — see the judgment-call note above and the open question below.
- **`hlc.ts`'s logical clock is purely local: it never observes a remote
  clock value, by design.** A device only ever writes its own Drive file
  (§10.19), so its own tick sequence never needs to fold in another
  device's timestamp. The clamp-against-Drive's-server-`Date`-header
  behavior §10.19 describes is a property of whoever calls this clock with
  a bounded `now()`, not something this module does itself — nothing calls
  it yet, and it shouldn't exist until something does (no knobs nobody
  turns).
- **The outbox is one database for the whole device, not scoped per
  profile.** `repoProvider.getRepo()` still serves a single active repo
  (§10.15's profile scoping doesn't reach the write path), so there is
  exactly one thing to queue writes for today. Flagged as a real gap below,
  not silently fine forever.
- **`basedOn` is resolved from this device's own outbox history only.**
  The correct source once a sync engine exists is the merged/replayed log
  (which could include another device's more recent op for the same
  entity); that source doesn't exist yet, so this is the honest local-only
  approximation available this wave. Flagged below for whoever builds pull.
- **A repo-write failure's error Toast reuses `home:error.codes.*`** (the
  same `RepoErrorCode` copy the three read screens already show) via a
  small `Record<RepoErrorCode, ToastMessageKey>` local to `dataStore.ts`,
  rather than extending `src/lib/errorCopy.ts` (see "Spec deltas": that file
  wasn't in this track's named blast radius, and duplicating a 5-line table
  seemed the more conservative choice than reaching into a file another
  track built). Worth unifying later — see open questions.
- **`getDeviceId()` lives on `deviceStore.ts`'s existing `kurobello-device`
  connection, not a new database.** Matches that file's own stated
  posture ("one device-signal database beats N separate ones") and the
  precedent Track R already set by folding `kurobello-network`/
  `kurobello-profiles` into it once ownership allowed.

## Backlog / deferred (for specs.md §12)

- **The outbox needs to become profile-scoped once `repoProvider` serves
  more than one profile at a time.** Today's single `kurobello-outbox`
  database will mix operations from different profiles/accounts the moment
  that changes. Whoever wires profile-aware writes should either key
  `OutboxEntry` by profile id or give each profile its own outbox database
  (mirroring `db.ts`'s per-profile pattern) before that lands.
- **`basedOn` needs a replay-derived source once Track Z's pull/merge
  exists**, not just this device's own outbox history — see the decision
  above. Building that properly requires a "last known hlc per entity"
  ledger derived from the merged log, which only makes sense once replay is
  real.
- **Config's sync-merge granularity is still unspecified.** §10.19 says
  files hold operations, not state, and gives a worked example for
  `Movimiento`; it never says whether `Config` merges as a single
  last-write-wins object (what this track's outbox does — one `put` op per
  `updateConfig` call, keyed by a fixed `'config'` entity id) or per-item
  (each `Seccion`/`Categoria` getting its own id-keyed op, closer to how
  `Movimiento` works). This track picked whole-object because `repo.ts`'s
  own `updateConfig(patch: Partial<Config>)` already does a shallow
  whole-row merge, so the outbox just mirrors that — but if Track Z decides
  per-item merging is needed for `secciones`/`categorias` to survive a real
  concurrent edit, the outbox's `config` operation shape needs revisiting.
- **A `Record<RepoErrorCode, ToastMessageKey>` now exists in two places**
  (`src/lib/errorCopy.ts`'s namespace-relative table for inline/component
  callers, and `dataStore.ts`'s full-key table for Toast callers) with the
  same five `RepoErrorCode` branches. Not a behavioral bug — the two
  produce different key shapes for different callers — but worth a
  follow-up to fold `dataStore.ts`'s into a `repoErrorToastKey()` export
  from `errorCopy.ts` so there's a single source for the `RepoErrorCode →
copy` mapping, the same "fix the shape" instinct `AGENTS.md` asks for.
- **No store-level success Toast** on any of the four mutations — see
  "What was built" above. Wave 4 screens will need to decide, per action,
  whether they want one and with what copy.

## Doc lines to add (exact file, exact place, exact text)

All in `src/lib/README.md`. The file is a flat bullet list, one entry per
module in the order the modules appear in `src/lib/`; insert accordingly
(the operator applies these — I don't own this file this stage).

**Replace the existing `dataStore.ts` bullet** (currently: "`dataStore.ts`
— zustand store holding the raw `movimientos`/`activos`/`config` the Wave 2
screens read, plus `status`/`error`. No derived totals cached here —
screens compute those from `movimientoStats` at the call site. `load()` is
idempotent and race-safe (mirrors `authStore.restore()`'s synchronous
check-then-set guard) and owns its own error handling end to end: a failure
lands in `error` as a `RepoErrorCode`, never thrown past `load()`.") with:

```
- `dataStore.ts` — zustand store holding the raw `movimientos`/`activos`/
  `config` the Wave 2 screens read, plus `status`/`error`. No derived totals
  cached here — screens compute those from `movimientoStats` at the call
  site. `load()` is idempotent and race-safe (mirrors `authStore.restore()`'s
  synchronous check-then-set guard) and owns its own error handling end to
  end: a failure lands in `error` as a `RepoErrorCode`, never thrown past
  `load()`. `createMovimiento`/`updateMovimiento`/`deleteMovimiento`/
  `updateConfig` (`specs.md` §10.13) are the write path Wave 4 builds on: one
  shared `runMutation()` helper per mutation — a single `networkStore.canWrite()`
  check, an optimistic apply (zustand updater form, so concurrent mutations
  never clobber each other), the repo write, then an outbox enqueue on
  success (never the other way — a repo failure must never depend on the
  outbox, and an outbox failure must never roll back a repo write that
  already succeeded), or an inverse-transform rollback plus a Toast
  (`docs/error-handling.md` §7) on failure. Never throws past the action,
  same contract as `load()`.
```

**Add after the `errorCopy.ts` bullet, new bullets for `hlc.ts` and
`outbox.ts`:**

```
- `hlc.ts` — a purely local hybrid logical clock (`specs.md` §10.19):
  `createLogicalClock(device, now?)` returns a `tick()` that yields a
  strictly increasing `Hlc` (zero-padded base36 `millis-counter-device`, so
  two values compare correctly as plain strings). Never observes a remote
  clock value on purpose — a device only ever writes its own Drive file, so
  its own tick sequence never needs another device's timestamp folded in.
- `outbox.ts` — the local, append-only queue of operations not yet pushed
  to Drive (`specs.md` §10.13/§10.19), plus `useOutboxStore`'s `dirty` flag
  for a future flush trigger. `enqueueOperation()` stamps the whole envelope
  (`hlc`/`basedOn`/`device`) itself; `basedOn` chains to this device's own
  last operation on the same entity id (`null` for a new one — the correct
  replay-derived source doesn't exist until a sync engine does). Storage:
  its own dexie database, `kurobello-outbox`, not a table on `db.ts`'s
  per-profile database (sync bookkeeping, not domain data). One outbox for
  the whole device today — `repoProvider.getRepo()` doesn't yet serve more
  than one profile at a time; revisit once it does (`specs.md` §12).
  `listPendingOperations()`/`removeOperations()` exist for Track Z's flush;
  nothing calls either yet, deliberately. Every read/write self-catches and
  logs, never throws.
```

**Amend the `networkStore.ts` bullet** — replace the sentence "`canWrite(kind,
now?)` is the single "may this write proceed?" answer: read/create always
allowed, edit/delete/settings refused offline regardless of the window,
create additionally refused past the window." with:

```
  `canWrite(kind, now?)` is the single "may this write proceed?" answer:
  read/create/delete always allowed offline, edit/settings refused offline
  regardless of the window, create and delete additionally refused past the
  window (`specs.md` §11, 2026-08-19 — deleting is now allowed offline too,
  since a delete is terminal and commutes the same way an append does; the
  window gates it the same way it already gated create).
```

**Amend the `deviceStore.ts` bullet** — after "...the `profiles` table
`profiles/profileRegistry.ts` owns." add a new sentence:

```
  A fifth, `deviceId`, holds one short id minted once via
  `crypto.getRandomValues` and cached for the process lifetime
  (`getDeviceId()`) — the id every op envelope and Drive filename this
  device produces carries (`specs.md` §10.19).
```

## Spec deltas (where this brief or §10.x turned out wrong)

- **§10.13, as written, predates §10.19 and doesn't mention the outbox,
  the logical clock, or a device id at all** — its "Blast radius" line says
  only `dataStore.ts` and its tests. The brief already flagged this and
  told me to reconcile against §10.19, which I did; recording here only so
  a future reader of §10.13 alone (without this file) isn't misled about
  scope.
- **The brief's hard-constraints file list doesn't literally include
  `src/lib/errorCopy.ts`.** I considered extending it with a
  `repoErrorToastKey()` export to avoid the small duplicated
  `RepoErrorCode → copy` table (see backlog above), decided that reaching
  into a file outside the brief's named list wasn't worth it for a 5-line
  table, and inlined the table in `dataStore.ts` instead. Flagging this as
  a place I read the brief conservatively rather than expansively — the
  operator may prefer the other call.
- **`toast:demo.*` (`toast.demo.saved`/`saveFailed`/`syncFailed` in the i18n
  tables) reads like it was seeded for real mutation copy but has zero
  production consumers** (confirmed by grep — only `toastStore.test.ts`
  references the key names, as a "don't let the table drift" comment, not
  a caller). I did not use it: "demo" as a namespace name is a Kit/dev-only
  signal in this codebase (`Kit.tsx` is the only consumer of anything
  named `demo`), and repurposing it for real Toast copy without renaming
  the namespace would blur that line. If a future track wants generic
  "movement saved"/"movement save failed" copy, it should get real keys
  under a real namespace, not adopt `toast:demo.*` as-is.

## Open questions for the operator

1. **Should the 7-hour offline window gate `delete` the same as `create`?**
   I judged yes (see the decision above) since the window's rationale was
   never conceptually create-specific, but §11's 2026-08-19 "deleting is
   allowed offline" entry doesn't say either way explicitly. If the intent
   was "delete is unconditionally allowed offline, no window," that's a
   one-line change to `MUTATION_ALLOWED_OFFLINE`'s consumer in `canWrite()`.
2. **Should `dataStore`'s mutations raise a success Toast?** I decided no
   (see above) since there's no real copy for it yet and nothing in the
   brief requires it. If Wave 4 screens are expected to get this for free
   rather than opting in themselves, that changes `runMutation()`'s shape
   and needs real i18n keys minted first.
3. **Is a single, unscoped outbox acceptable for this wave**, given
   `repoProvider` itself is still single-profile? I judged yes (matches the
   app's actual current capability) but flagged it in `specs.md` §12
   material above since it's a real gap the moment profile-scoped writes
   land.
4. **Config's op-log granularity** (whole-object vs. per-item) is a design
   call this track made by necessity (repo.ts's own `updateConfig` shallow-
   merges, so the outbox mirrors that) but §10.19 doesn't rule on it
   explicitly for `Config`. Worth a deliberate decision before Track Z
   builds `config-<device>.json` handling.

## `bun run check` output (pasted, real)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:74:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-t

 Test Files  90 passed (90)
      Tests  886 passed (886)
   Start at  20:00:36
   Duration  15.37s (transform 2.31s, setup 15.51s, import 41.50s, tests 19.83s, environment 46.02s)
```

The one warning (`button.tsx`, `react/only-export-components`) predates this
track — present on the pre-work baseline too, not introduced here.

Baseline before this track: 87 files / 843 tests, green. New: 3 files
(`hlc.test.ts`, `outbox.test.ts`, `deviceStore.upgrade.v4.test.ts`) / 43 new
tests, all green.
