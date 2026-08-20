# src/lib/sync

The Drive sync engine (`specs.md` §10.19): op-log format, replay/merge,
transport, sharding/compaction, and the "when it syncs" triggers. Built in
the order the spec's own review protocol asked for — format/replay/merge
first, fully tested with no network, before any transport code sat on top
of it.

- `opLog.ts` — pure types (no network, no repo) for the op envelope
  (`put`/`del`, `hlc`, `basedOn`) per entity (movimiento/activo/config),
  Drive filename conventions (`parseDriveFilename`/`buildMov*Filename`/…),
  periodo helpers, and the replay/merge engine itself: last-hlc-wins per id,
  with the one documented exception — a `del` concurrent with the `put`
  immediately before it (`del.basedOn !== put.hlc`) revives the record
  instead of discarding the edit (decided, specs.md §10.19). One generic
  `replayEntity()` serves movimientos, activos, and config (grouped under a
  single synthetic id — specs.md §12's known whole-object-put gap,
  deliberately not fixed here).
- `validate.ts` — turns untrusted Drive bytes into `opLog.ts`'s types, or
  rejects them: a malformed _entry_ is dropped without taking the rest of a
  good file down; a malformed _file_ (wrong shape, `ops` not an array, a
  newer `v` than `OP_FORMAT_VERSION`) is skipped whole. Pure and silent by
  design — the I/O layer that calls it is what logs a skip. One exception to
  "malformed → dropped": `Categoria.icono`/`.color` are sanitized, not
  rejected — an invalid value there strips just that field and keeps the
  category (specs.md §10.22's edge case), since they're presentational only
  and every core field still rejects the whole config as before. Every
  `parse*OpFile` returns `{ file, skipped }` (specs.md §12, 2026-08-20), not
  a bare `T | null` — `skipped` is the count of entries this call dropped,
  so the caller can carry it somewhere real (`PullSummary.skippedEntries`)
  instead of the count only ever existing as a log line.
- `driveFiles.ts` — where `opLog.ts`'s types and `validate.ts`'s checks meet
  `drive.ts`'s REST client: folder resolution (`FOLDER_NAME`, the frozen
  storage id, lives here), listing both spaces, downloads that degrade to
  `{ file: null, skipped: 0 }` (never throw) on a malformed/truncated file
  and log a skip count > 0 right here (the one place that knows _which_
  file/entry), and uploads that always target this device's own filename.
  `ensureFolder()` is coalesced against itself, keyed by `token`: a device's
  very first sync calls it from both `pull()` and `push()`, and `onOnline`
  fires both without awaiting either — an unguarded check-then-create here
  would create two different `KuroBello` folders for one account, or (worse,
  if the key were missing entirely) hand a concurrent call for a _second_
  account the first account's folder id. Keyed, not a single shared slot,
  for exactly that second reason (specs.md §10.26 §1's sweep).
- `leeme.ts` — the plain-language `LEEME.txt` content `bootstrap.ts` writes
  into the folder, localized per `SupportedLocale`. Its own module, not the
  shared `i18n/locales/*.json` tables — this is prose for a Drive folder, a
  person may open it in a text editor, not a UI string.
- `tip.ts` — a device-scoped cache (`deviceStore.ts`'s `syncTips` table) of
  "the last hlc this device knows about, per entity." Closes a real gap:
  `outbox.ts`'s `basedOn` used to only look at this device's own outbox
  history, which is wrong the moment a pull teaches it about a newer
  version it never queued itself — see `outbox.ts`'s `lastHlcFor` comment
  for the traced bug this fixes.
- `status.ts` — pure derivation of every sync question a UI could ask
  (linked to Drive? ever synced? syncing/pending/up to date?) from the
  watermark (`profiles/profileRegistry.ts`'s `driveFolderId`/`lastPushAt`/
  `lastPullAt`) instead of a stored `isSynced` flag that could drift from
  reality.
- `engine.ts` — the orchestration: `pull()` (revision-checked download,
  replay, materialize into the profile's own local db — folding in this
  device's own pending outbox ops first, so a pull can never clobber a
  not-yet-pushed local write), `push()` (append this device's own pending
  ops to its own shard/config files; defers rather than overwrites blind if
  an existing shard can't be verified first), `compactYear()` (conservative
  — aborts without deleting anything if any one of this device's own
  monthly files can't be verified; writes the yearly CSV through
  `export/csv.ts`, never a second implementation), and `startSyncTriggers()`
  (reconnect/foreground pulls, a debounced push after the outbox goes
  dirty, a best-effort push on `pagehide`). `useSyncStore` holds the
  in-flight phase, pull progress (the first-run download view,
  `src/features/sync/`), and `lastPullSummary` (the most recent
  `PullSummary` — `syncSession.ts`'s one subscriber raises the
  revived-movement Toast off this, regardless of which call site produced
  it). **`pull()` and `push()` are each coalesced against themselves,
  keyed by `profile.id`** (specs.md §10.26 §1, the data-loss fix this
  track opened with, reproduced by the general review; the `profile.id`
  keying added by this track's own review — see specs.md §11, 2026-08-20
  "Track AB review"): a second concurrent call for the _same_ profile
  returns the in-flight promise rather than racing it with an independent
  read-modify-write against the same Drive file; a call for a _different_
  profile (the `boot.ts` rebind race — a fast logout+relogin never waits
  for an in-flight pull/push before redirecting the outbox/repo binding)
  gets its own promise instead of silently riding the other profile's,
  which is what `ensureFolder()`'s own `token`-keyed guard already avoided
  but `pull()`/`push()` originally did not. `startSyncTriggers()`'s debounced
  push also re-arms itself after settling if the outbox is still dirty —
  a write enqueued while an earlier push was already in flight never flips
  the dirty-store's false→true edge the plain subscription reacts to, so
  without this it could sit unpushed until an unrelated online/visibility/
  pagehide event happened to occur. `startSyncTriggers()`'s `getContext`
  may return a `Promise` — `syncSession.ts`'s real one does, to check token
  freshness before a trigger fires.
- `syncSession.ts` — the live context specs.md §10.26 §2 asks for
  (`getSyncContext()`: the current Drive-scoped token — refreshed silently,
  in place, if within 60s of `expiresAt` — the active profile from
  `repoProvider`'s binding, and the current copy locale), and the one place
  `startSyncTriggers()`'s handle is owned in production
  (`startSyncSession()`/`stopSyncSession()`, both idempotent). Start/stop is
  a **reactive subscription on `authStore`**, not explicit calls added
  inside `login`/`restore`/`hydrate`/`connectDrive`/`logout`/
  `continueAsGuest`: `authStore.ts` cannot import this module back (it
  already imports `authStore.ts`), the identical circular-import shape
  `lockStore.ts`'s own bottom-of-file `useAuthStore.subscribe` solves the
  same way. Covers every path that sets/clears `drive`; "stop on lock" (and its
  counterpart, "start on unlock") are the one pair of transitions it
  structurally cannot see (locking never touches `authStore`, and
  `hydrate()` on a successful unlock re-sets `status`/`drive` to the exact
  values a lock never changed, so the subscription's edge detection never
  fires either way) — both hookpoints live in `lockStore.ts`'s own `lock()`
  and `resume()` instead, calling `stopSyncSession()`/`startSyncSession()`
  explicitly (the latter added by this track's own review, specs.md §11,
  2026-08-20 "Track AB review" — the original code left the restart to the
  subscription, which never actually fired, silently killing live sync for
  the rest of the session after the very first lock). `runInitialSync()` ("pull on app open," specs.md §10.19) is
  **not** called from here either, for the identical reason: `drive`
  becoming non-null can race `boot.ts` binding a profile (the automatic
  reacquire path runs from `RequireAuth`, a sibling of `BootGate`, not a
  child) — `src/features/sync/FirstSyncGate.tsx` is the one place a binding
  is guaranteed to exist, so it owns calling this. Imported once, for its
  subscription side effect, from `src/main.tsx`.

**Wired into the running app** (specs.md §10.26): `repoProvider.getRepo()`
serves the profile the boot sequence bound (`src/lib/boot.ts`, landed by
the flip), and `syncSession.ts` above is what starts/stops the triggers for
real. `pull`/`push`/`startSyncTriggers` still take an explicit
`{ token, profile, locale }` rather than reaching into `authStore.ts`
themselves — this module stays testable with no live store — `syncSession.ts`
is the adapter that supplies it.

`repo.drive.ts` (one level up, `src/lib/repo.drive.ts`) is the `Repo`-port
side of this: it delegates every CRUD call straight to `repo.local.ts`,
deliberately, because §10.19 states the local database is always the
merged truth — there is no "read/write Drive directly" path in the `Repo`
contract to build. What actually makes a profile Drive-backed lives here,
outside the port.

**Known residual risk, not closed by this track (documented, not
silently accepted): two tabs of the same signed-in account.** `pull()`/
`push()`/`ensureFolder()`'s in-flight guards are plain module-level state —
real within one tab, invisible across two. Two tabs each starting their own
sync triggers (nothing here elects a leader or coordinates across tabs, no
`BroadcastChannel`/Web Locks) can still race each other at the Drive-file
level the same way a single tab used to race itself before this track's
fix. Recommended follow-up: a cross-tab leader election (Web Locks API is
the natural fit) before this ships to users who routinely keep two tabs
open.
