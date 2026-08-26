# src/lib/sync

The Drive sync engine: op-log format, replay/merge, transport, sharding/compaction, and the sync triggers.

- `opLog.ts` — pure types (no network, no repo) for the op envelope (`put`/`del`, `hlc`, `basedOn`) per entity (movimiento/activo/config), Drive filename conventions (`parseDriveFilename`/`buildMov*Filename`/…), periodo helpers, and the replay/merge engine (`replayEntity`, `replayMovimientos`, `replayActivos`, `replayConfig`).
- `validate.ts` — turns untrusted Drive bytes into `opLog.ts`'s types, or rejects them. Malformed entries are dropped without taking the rest of a good file down; a malformed file is skipped whole. Every `parse*OpFile` returns `{ file, skipped }`.
- `driveFiles.ts` — where `opLog.ts`'s types and `validate.ts`'s checks meet `../drive.ts`'s REST client: folder resolution (`ensureFolder`, `FOLDER_NAME`), listing both spaces, downloads, uploads.
- `leeme.ts` — the plain-language `LEEME.txt` content written into the Drive folder, localized per `SupportedLocale`.
- `tip.ts` — a device-scoped cache (`deviceStore.ts`'s `syncTips` table) of the last hlc known per entity, read by `../outbox.ts`'s `basedOn` resolution.
- `status.ts` — pure derivation of sync UI questions (linked to Drive? ever synced? syncing/pending/up to date?) from the watermark on `ProfileRecord`.
- `engine.ts` — orchestration: `pull()` (revision-checked download, replay, materialize into the profile's own local db), `push()` (append this device's own pending ops to its own shard/config files), `compactYear()`/`compactClosedYearsIfNeeded()` (yearly compaction, writes the CSV via `../export/csv.ts`), and `startSyncTriggers()` (reconnect/foreground pulls, debounced push, `pagehide` push). `useSyncStore` holds the in-flight phase, pull progress, and `lastPullSummary`. `pull()`/`push()` are each coalesced against themselves, keyed by `profile.id`.
- `syncSession.ts` — the live `SyncContext` supplier (`getSyncContext()`: current Drive-scoped token, refreshed if near expiry; the active profile from `repoProvider`'s binding; the current locale) and the owner of `startSyncTriggers()`'s handle in production (`startSyncSession()`/`stopSyncSession()`, both idempotent). Start/stop is a reactive subscription on `authStore`; lock/unlock hookpoints live in `lockStore.ts` instead. `runInitialSync()` is called from `src/features/sync/FirstSyncGate.tsx`. Imported once, for its subscription side effect, from `src/main.tsx`.

`../repo.drive.ts` is the `Repo`-port side of this: it delegates every CRUD call to `repo.local.ts`, since the local database is always the merged truth — there is no "read/write Drive directly" path in the `Repo` contract.
