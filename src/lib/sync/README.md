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
  design — the I/O layer that calls it is what logs a skip.
- `driveFiles.ts` — where `opLog.ts`'s types and `validate.ts`'s checks meet
  `drive.ts`'s REST client: folder resolution (`FOLDER_NAME`, the frozen
  storage id, lives here), listing both spaces, downloads that degrade to
  `null` (never throw) on a malformed/truncated file, and uploads that
  always target this device's own filename.
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
  in-flight phase and pull progress for a future first-run download view.

**Not wired into the running app.** `repoProvider.getRepo()` stays the
fake-repo stub this wave (`AGENTS.md` forbids flipping it before a create
UI exists), so `pull`/`push`/`startSyncTriggers` all take an explicit
`{ token, profile }` rather than reaching into `authStore.ts` themselves —
same posture `outbox.ts` shipped with a wave before its first caller.
Whoever wires the create UI and flips `getRepo()` is also who calls
`bootstrap()` → `startSyncTriggers()` for real.

`repo.drive.ts` (one level up, `src/lib/repo.drive.ts`) is the `Repo`-port
side of this: it delegates every CRUD call straight to `repo.local.ts`,
deliberately, because §10.19 states the local database is always the
merged truth — there is no "read/write Drive directly" path in the `Repo`
contract to build. What actually makes a profile Drive-backed lives here,
outside the port.
