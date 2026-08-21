import { create } from 'zustand'
import { findFile, getLastKnownServerTime, type DriveFileListing } from '@/lib/drive'
import { deviceDb, getDeviceId } from '@/lib/deviceStore'
import { buildMovimientoCsvParts } from '@/lib/export/csv'
import { CONFIG_ID, type ProfileDb } from '@/lib/db'
import {
  getProfileDatabase,
  recordSuccessfulPull,
  recordSuccessfulPush,
  setDriveFolderId,
} from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import {
  clampOutboxClockToServer,
  listPendingOperations,
  observeRemoteHlc,
  removeOperations,
  useOutboxStore,
  type OutboxEntry,
} from '@/lib/outbox'
import {
  downloadActFile,
  downloadConfigFile,
  downloadMovFile,
  ensureFolder,
  listAppDataFiles,
  listKuroBelloFiles,
  uploadConfigFile,
  uploadMovShard,
  writeLeeme,
  writeYearlyCsv,
} from '@/lib/sync/driveFiles'
import {
  buildMovMonthFilename,
  currentPeriodo,
  currentYear,
  parseDriveFilename,
  replayActivos,
  replayConfig,
  replayMovimientos,
  CONFIG_ENTITY_ID,
  OP_FORMAT_VERSION,
  type ActOpFile,
  type ConfigOpEntry,
  type ConfigOpFile,
  type MovOpEntry,
  type MovOpFile,
} from '@/lib/sync/opLog'
import { recordKnownTip } from '@/lib/sync/tip'
import { deriveSyncIndicator, type SyncIndicator } from '@/lib/sync/status'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { SCHEMA_VERSION, type Activo, type Config, type Movimiento } from '@/lib/schema'
import { deleteFile } from '@/lib/drive'

// engine.ts — the sync orchestration specs.md §10.19 describes: pull
// (revision-checked download + replay + materialize into the local db),
// push (append this device's own pending ops to its own shard/config
// files), yearly compaction, and the trigger wiring for "when it syncs."
//
// Deliberately **not wired into the running app**: `repoProvider.getRepo()`
// stays the fake-repo stub this wave (AGENTS.md forbids flipping it before
// a create UI exists), so there is no live token/profile source to drive
// this from yet — same posture `outbox.ts` shipped with a wave before its
// first caller. `pull`/`push` take an explicit `{ token, profile }` rather
// than reaching into authStore.ts themselves, so this module stays
// testable and decoupled until whichever later track wires it in.

// --- the sync store (§10.19 UI: syncing · up to date · pending) ----------

interface SyncState {
  phase: 'idle' | 'pulling' | 'pushing'
  /** Real progress for the first-run download view (a later track) — files reconciled of total, never an indefinite spinner. */
  pullProgress: { done: number; total: number } | null
  lastError: string | null
  /**
   * The most recent successful pull's summary — every `PullSummary` field
   * this store doesn't otherwise expose (the revived-ids/skipped-entries
   * counts, specs.md §10.26 §4) rides here instead of each of `pull()`'s
   * several call sites (the trigger wiring, the first-run download view, a
   * manual retry) separately deciding whether to raise a notice. A single
   * subscriber (`syncSession.ts`) reacts to this changing and owns raising
   * the revived-movement Toast exactly once per pull, regardless of which
   * call site produced it.
   */
  lastPullSummary: PullSummary | null
}

export const useSyncStore = create<SyncState>(() => ({
  phase: 'idle',
  pullProgress: null,
  lastError: null,
  lastPullSummary: null,
}))

/** What a future sync indicator renders — combines this store's own phase with the outbox's independent dirty flag. */
export const getSyncIndicator = (): SyncIndicator =>
  deriveSyncIndicator({
    isSyncing: useSyncStore.getState().phase !== 'idle',
    outboxDirty: useOutboxStore.getState().dirty,
  })

// --- materializing a replay result into the profile's own local db --------
//
// The local database is always the merged truth (specs.md §10.19's blast
// radius): a pull's replay result *replaces* the local table's content —
// but replay's own input already folds in this device's own not-yet-pushed
// outbox ops (see `pendingAsFiles` below), so a pull can never clobber a
// local write that hasn't reached Drive yet.

const materializeMovimientos = async (
  database: ProfileDb,
  items: readonly Movimiento[],
): Promise<void> => {
  await database.transaction('rw', database.movimientos, async () => {
    const existingIds = await database.movimientos.toCollection().primaryKeys()
    const keep = new Set(items.map((m) => m.id))
    const toDelete = existingIds.filter((id) => !keep.has(id as string))
    if (toDelete.length > 0) await database.movimientos.bulkDelete(toDelete)
    if (items.length > 0) await database.movimientos.bulkPut([...items])
  })
}

const materializeActivos = async (database: ProfileDb, items: readonly Activo[]): Promise<void> => {
  await database.transaction('rw', database.activos, async () => {
    const existingIds = await database.activos.toCollection().primaryKeys()
    const keep = new Set(items.map((a) => a.id))
    const toDelete = existingIds.filter((id) => !keep.has(id as string))
    if (toDelete.length > 0) await database.activos.bulkDelete(toDelete)
    if (items.length > 0) await database.activos.bulkPut([...items])
  })
}

// A newer schemaVersion than this build knows is ignored and left untouched
// (edge cases) — the local config simply keeps whatever it already had.
const materializeConfig = async (
  database: ProfileDb,
  config: Config | undefined,
): Promise<void> => {
  if (!config || config.schemaVersion > SCHEMA_VERSION) return
  await database.config.put({ ...config, id: CONFIG_ID })
}

// --- folding this device's own pending outbox ops into replay -------------
//
// Without this, a pull that runs before this device's own writes have been
// pushed would replay Drive's files alone and silently delete/overwrite
// local-only data from the materialized result. A synthetic "file" built
// from the outbox's own envelopes (hlc/basedOn already stamped by
// enqueueOperation) folds them into the exact same merge as everything
// else — a pending write with the newest hlc wins the same way a pushed
// one would on any other device.

const pendingMovFile = (pending: readonly OutboxEntry[], device: string): MovOpFile => ({
  v: OP_FORMAT_VERSION,
  device,
  periodo: currentPeriodo(),
  ops: pending
    .filter(
      (e): e is OutboxEntry & { operation: { entity: 'movimiento' } } => e.entity === 'movimiento',
    )
    .map(
      (e): MovOpEntry =>
        e.operation.op === 'put'
          ? { op: 'put', hlc: e.hlc, basedOn: e.basedOn, mov: e.operation.payload }
          : { op: 'del', hlc: e.hlc, basedOn: e.basedOn, id: e.operation.payload.id },
    ),
})

const pendingConfigFile = (pending: readonly OutboxEntry[], device: string): ConfigOpFile => ({
  v: OP_FORMAT_VERSION,
  device,
  ops: pending
    .filter((e): e is OutboxEntry & { operation: { entity: 'config' } } => e.entity === 'config')
    .map(
      (e): ConfigOpEntry => ({
        op: 'put',
        hlc: e.hlc,
        basedOn: e.basedOn,
        config: e.operation.payload,
      }),
    ),
})

// --- pull ------------------------------------------------------------

export interface PullSummary {
  filesReconciled: number
  /** Ids revived by the concurrent delete-vs-edit rule this pull — the caller (a future UI) is what says why, per specs.md §10.19. */
  revivedMovIds: string[]
  /** Malformed entries dropped across every file this pull reconciled — already logged per-file by `driveFiles.ts`'s downloads; this is the aggregate a future "N entries were skipped" notice reads (specs.md §12, 2026-08-20). */
  skippedEntries: number
}

const DOWNLOADABLE_KINDS = new Set(['mov-month', 'mov-year', 'act', 'config'])

/**
 * `files.list` revision check, download only what changed (cached raw
 * files fill in the rest — see `deviceStore.ts`'s `syncFileCache`), replay,
 * materialize into the local db, then the watermark and the local clock
 * both learn what this pull taught them.
 *
 * `locale` has no default: it is only ever needed for the best-effort
 * yearly-compaction check below (`LEEME.txt`/the yearly CSV, specs.md
 * §10.19), but threading it as a required parameter instead of a default
 * means a caller that forgets to pass it is a compile error, not a
 * `LEEME.txt` silently written in English for a Spanish-reading user
 * (specs.md §11, 2026-08-19).
 *
 * Coalesced against itself the same way `push()` is (specs.md §10.26 §1's
 * sweep): `onOnline` and `onVisible` (which itself calls `onOnline`) can
 * both fire within the same tick on a real reconnect, and the first-run
 * download view's own pull races the trigger wiring's "pull on app open."
 * Concurrent pulls don't lose data the way concurrent pushes do (replay is
 * a pure function of the same inputs, and `materializeMovimientos` is an
 * idempotent replace) — but they redouble every download, and
 * `compactYear`'s unconditional `deleteFile` on this device's own already-
 * compacted months is not itself idempotent against a second compaction
 * racing it (an already-deleted file's second delete throws, caught only by
 * `pull()`'s own fire-and-forget `.catch()` several frames up). Coalescing
 * removes the redundant work and the race both, for the identical reason
 * `push()`'s guard does.
 *
 * Keyed by `profile.id`, not a single shared slot — `boot.ts`'s rebind path
 * (logout, then a new login) proceeds immediately, with no coordination
 * with a pull already in flight for the *previous* profile: a bare
 * unkeyed guard hands a fresh call for the new profile the old profile's
 * still-resolving promise, which was built to materialize into the *old*
 * profile's own database (`getProfileDatabase(profile.databaseName)`
 * closes over pull's own `profile` argument). `FirstSyncGate`'s
 * `DriveDownloadScreen` then sees that promise resolve successfully and
 * calls `onDone()`, dismissing the first-run gate for a profile whose own
 * database was never touched — an empty dashboard presented as "synced,"
 * indistinguishable from data loss. Reproduced against the real code
 * (`sync/engine.test.ts`'s cross-profile pull test) before this fix; keyed
 * exactly like `driveFiles.ts`'s `ensureFolder()` already is, for the
 * identical reason.
 */
const pullInFlight = new Map<string, Promise<PullSummary>>()

export const pull = (
  token: string,
  profile: ProfileRecord,
  locale: SupportedLocale,
): Promise<PullSummary> => {
  const existing = pullInFlight.get(profile.id)
  if (existing) return existing
  const inFlight = pullOnce(token, profile, locale).finally(() => {
    pullInFlight.delete(profile.id)
  })
  pullInFlight.set(profile.id, inFlight)
  return inFlight
}

const pullOnce = async (
  token: string,
  profile: ProfileRecord,
  locale: SupportedLocale,
): Promise<PullSummary> => {
  useSyncStore.setState({ phase: 'pulling', pullProgress: null, lastError: null })
  try {
    const folderId = profile.driveFolderId ?? (await ensureFolder(token))
    if (profile.driveFolderId !== folderId) await setDriveFolderId(profile.id, folderId)

    const [driveListing, appDataListing] = await Promise.all([
      listKuroBelloFiles(token, folderId),
      listAppDataFiles(token),
    ])

    const serverTime = getLastKnownServerTime()
    if (serverTime !== null) await clampOutboxClockToServer(serverTime)

    const candidates = [...driveListing, ...appDataListing]
      .map((listing) => ({ listing, parsed: parseDriveFilename(listing.name) }))
      .filter((c) => DOWNLOADABLE_KINDS.has(c.parsed.kind))

    useSyncStore.setState({ pullProgress: { done: 0, total: candidates.length } })

    const movFiles: MovOpFile[] = []
    const actFiles: ActOpFile[] = []
    const configFiles: ConfigOpFile[] = []
    let done = 0
    let skippedEntries = 0

    for (const { listing, parsed } of candidates) {
      const { file, skipped } = await resolveFile(token, listing, parsed.kind)
      skippedEntries += skipped
      if (file) {
        if (parsed.kind === 'mov-month' || parsed.kind === 'mov-year')
          movFiles.push(file as MovOpFile)
        else if (parsed.kind === 'act') actFiles.push(file as ActOpFile)
        else configFiles.push(file as ConfigOpFile)
      }
      done += 1
      useSyncStore.setState({ pullProgress: { done, total: candidates.length } })
    }

    const device = await getDeviceId()
    // The pulling profile's own database, explicitly — not whatever
    // `outbox.ts`'s module-level redirect currently points to (specs.md
    // §10.31 edge case: a switch mid-pull must not fold a *different*
    // profile's pending ops into this replay).
    const database = getProfileDatabase(profile.databaseName)
    const pending = await listPendingOperations(database)
    movFiles.push(pendingMovFile(pending, device))
    configFiles.push(pendingConfigFile(pending, device))

    const movResult = replayMovimientos(movFiles)
    const actResult = replayActivos(actFiles)
    const configResult = replayConfig(configFiles)

    await Promise.all([
      materializeMovimientos(database, movResult.items),
      materializeActivos(database, actResult.items),
      materializeConfig(database, configResult.config),
    ])

    const tipWrites: Promise<void>[] = []
    const observations: Promise<void>[] = []
    for (const [id, tip] of movResult.tips) {
      tipWrites.push(recordKnownTip('movimiento', id, tip.hlc))
      observations.push(observeRemoteHlc(tip.hlc))
    }
    for (const [id, tip] of actResult.tips) {
      tipWrites.push(recordKnownTip('activo', id, tip.hlc))
      observations.push(observeRemoteHlc(tip.hlc))
    }
    if (configResult.tip) {
      tipWrites.push(recordKnownTip('config', CONFIG_ENTITY_ID, configResult.tip.hlc))
      observations.push(observeRemoteHlc(configResult.tip.hlc))
    }
    await Promise.all([...tipWrites, ...observations])

    await recordSuccessfulPull(profile.id)

    const summary: PullSummary = {
      filesReconciled: candidates.length,
      revivedMovIds: movResult.revivedIds,
      skippedEntries,
    }
    useSyncStore.setState({ phase: 'idle', pullProgress: null, lastPullSummary: summary })

    void compactClosedYearsIfNeeded(
      token,
      profile,
      movResult.items,
      csvTaxonomy(configResult.config),
      locale,
    ).catch((e: unknown) =>
      console.warn('sync: compaction check failed, will retry on the next pull', e),
    )

    return summary
  } catch (e) {
    useSyncStore.setState({
      phase: 'idle',
      pullProgress: null,
      lastError: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}

// Cached-file lookup lives here (not driveFiles.ts) since it needs the
// device-scoped cache table `sync/tip.ts`'s siblings live beside —
// deviceStore.ts's `syncFileCache`. A cache hit trusts its own content
// without re-validating (validate.ts already ran the one time it was
// written); a cache miss or a stale `modifiedTime` downloads fresh.
const resolveFile = async (
  token: string,
  listing: DriveFileListing,
  kind: string,
): Promise<{ file: MovOpFile | ActOpFile | ConfigOpFile | null; skipped: number }> => {
  let cached: { modifiedTime: string; file: unknown; skipped: number } | undefined
  try {
    cached = await deviceDb.syncFileCache.get(listing.id)
  } catch (e) {
    console.warn(`sync: could not read the file cache for ${listing.name}, re-downloading`, e)
  }
  if (cached && cached.modifiedTime === listing.modifiedTime) {
    // Still reported every pull, not just the download that first found it
    // — the entries really are missing from the merged data on every pull
    // that includes this file, cached or not (specs.md §12, 2026-08-20).
    return {
      file: cached.file as MovOpFile | ActOpFile | ConfigOpFile | null,
      skipped: cached.skipped,
    }
  }

  const { file, skipped } =
    kind === 'mov-month' || kind === 'mov-year'
      ? await downloadMovFile(token, listing.id)
      : kind === 'act'
        ? await downloadActFile(token, listing.id)
        : await downloadConfigFile(token, listing.id)

  try {
    await deviceDb.syncFileCache.put({
      id: listing.id,
      modifiedTime: listing.modifiedTime,
      file,
      skipped,
    })
  } catch (e) {
    console.warn(`sync: could not cache ${listing.name}, will re-download next pull`, e)
  }
  return { file, skipped }
}

// --- push --------------------------------------------------------------
//
// "Exactly one device ever writes any given file" (specs.md §10.19) means
// push is always append-to-this-device's-own-file, never a merge on the
// write path. The one hazard it must not create itself: if an existing
// shard can't be *verified* (found but failed to download/parse — a
// network blip, not necessarily real corruption), overwriting it blind
// would be data loss this design otherwise never risks. So a shard push
// that can't confirm its prior content is skipped for this round rather
// than guessed at; the outbox keeps those ops queued for the next trigger.

const toMovOpEntry = (e: OutboxEntry): MovOpEntry =>
  e.operation.op === 'put' && e.operation.entity === 'movimiento'
    ? { op: 'put', hlc: e.hlc, basedOn: e.basedOn, mov: e.operation.payload }
    : {
        op: 'del',
        hlc: e.hlc,
        basedOn: e.basedOn,
        id: (e.operation as { payload: { id: string } }).payload.id,
      }

const pushMovShard = async (
  token: string,
  folderId: string,
  device: string,
  entries: readonly OutboxEntry[],
): Promise<string[]> => {
  if (entries.length === 0) return []
  const periodo = currentPeriodo()
  const filename = buildMovMonthFilename(device, periodo)
  const existingId = await findFile(token, { name: filename, parent: folderId })

  let baseOps: MovOpEntry[] = []
  if (existingId) {
    const { file: existing } = await downloadMovFile(token, existingId)
    if (!existing) {
      console.warn(
        `sync: could not verify existing shard "${filename}" before pushing — deferring, will retry next trigger`,
      )
      return []
    }
    baseOps = existing.ops
  }

  const updated: MovOpFile = {
    v: OP_FORMAT_VERSION,
    device,
    periodo,
    ops: [...baseOps, ...entries.map((e) => toMovOpEntry(e))],
  }
  await uploadMovShard(token, folderId, updated)
  return entries.map((e) => e.id)
}

const pushConfig = async (
  token: string,
  device: string,
  entries: readonly OutboxEntry[],
): Promise<string[]> => {
  if (entries.length === 0) return []
  const filename = `config-${device}.json`
  const existingId = await findFile(token, { name: filename, space: 'appDataFolder' })

  let baseOps: ConfigOpEntry[] = []
  if (existingId) {
    const { file: existing } = await downloadConfigFile(token, existingId)
    if (!existing) {
      console.warn(
        `sync: could not verify existing "${filename}" before pushing — deferring, will retry next trigger`,
      )
      return []
    }
    baseOps = existing.ops
  }

  const ops: ConfigOpEntry[] = entries.map((e) => {
    if (e.operation.entity !== 'config') throw new Error('pushConfig received a non-config entry')
    return { op: 'put', hlc: e.hlc, basedOn: e.basedOn, config: e.operation.payload }
  })
  const updated: ConfigOpFile = { v: OP_FORMAT_VERSION, device, ops: [...baseOps, ...ops] }
  await uploadConfigFile(token, updated)
  return entries.map((e) => e.id)
}

/**
 * Pushes every currently-pending outbox op. A no-op when the outbox is
 * empty — the dirty flag is what keeps a reconnect free when there is
 * nothing to send.
 *
 * The two entity types are pushed and settled independently
 * (`Promise.allSettled`, not `Promise.all`): a movimiento shard write and a
 * config write are two unrelated Drive files, so one failing must never
 * stop the other's already-durable write from being recorded. `Promise.all`
 * would reject as soon as either promise rejects, before `removeOperations`
 * ever runs — the entity type that *did* upload successfully would stay
 * marked pending, and the next retry would re-download its file and append
 * the same entries onto it a second time (a silent duplicate, not data
 * loss, but exactly the "grows the file forever" failure this format
 * otherwise avoids).
 */
// A module-level coalescing guard, the same shape as `boot.ts`'s `inFlight`
// (specs.md §10.26 §1, CONFIRMED and reproduced by the general review): a
// second `push()` call arriving before the first settles must never start
// its own independent read-modify-write against the same Drive file — two
// concurrent pushes each read a shard, append their own view of "pending,"
// and the later write silently overwrites the earlier one, permanently
// dropping whatever the earlier push uploaded from *both* Drive and the
// outbox that would have retried it. Refusing (here: coalescing into the
// same promise) is sufficient — every trigger path that calls `push()`
// already treats "nothing to do" as a safe no-op, so an op left behind by a
// coalesced call simply waits for the next trigger, which is a genuine
// no-op-safe deferral, not a loss.
//
// Keyed by `profile.id`, same reasoning and same fix as `pull()` above: an
// unkeyed guard handed a `push()` call for a *different* profile (the
// `boot.ts` rebind race) the previous profile's in-flight promise, which
// reads `entries` (`outbox.ts`'s module-level table pointer) and `token`/
// `folderId` all closed over the *old* profile — the new profile's own
// pending ops are silently never uploaded this round. Reproduced against
// the real code (`sync/engine.test.ts`'s cross-profile push test).
const pushInFlight = new Map<string, Promise<void>>()

export const push = (token: string, profile: ProfileRecord): Promise<void> => {
  const existing = pushInFlight.get(profile.id)
  if (existing) return existing
  const inFlight = pushOnce(token, profile).finally(() => {
    pushInFlight.delete(profile.id)
  })
  pushInFlight.set(profile.id, inFlight)
  return inFlight
}

const pushOnce = async (token: string, profile: ProfileRecord): Promise<void> => {
  // The pushing profile's own database, explicitly, for both reads and the
  // final `removeOperations` below (specs.md §10.31 edge case / §12,
  // 2026-08-20: the traced bug this closes). Not `outbox.ts`'s module-level
  // redirect — a switch mid-push must not drain the *new* profile's outbox
  // for ops this call actually uploaded on behalf of the old one.
  const database = getProfileDatabase(profile.databaseName)
  const pending = await listPendingOperations(database)
  if (pending.length === 0) return

  useSyncStore.setState({ phase: 'pushing', lastError: null })
  try {
    const folderId = profile.driveFolderId ?? (await ensureFolder(token))
    if (profile.driveFolderId !== folderId) await setDriveFolderId(profile.id, folderId)
    const device = await getDeviceId()

    const movEntries = pending.filter((e) => e.entity === 'movimiento')
    const configEntries = pending.filter((e) => e.entity === 'config')

    const [movOutcome, configOutcome] = await Promise.allSettled([
      pushMovShard(token, folderId, device, movEntries),
      pushConfig(token, device, configEntries),
    ])
    const pushedIds = [
      ...(movOutcome.status === 'fulfilled' ? movOutcome.value : []),
      ...(configOutcome.status === 'fulfilled' ? configOutcome.value : []),
    ]

    if (pushedIds.length > 0) {
      const pushedById = new Map(pending.map((e) => [e.id, e]))
      await Promise.all(
        pushedIds.map((id) => {
          const entry = pushedById.get(id)
          // Keeps the local clock's tip current the instant an op leaves the
          // outbox — see outbox.ts's lastHlcFor comment: without this, the
          // tip this device "forgets" the moment its own queue drains would
          // make the *next* local edit fall back to a stale basedOn.
          return entry ? recordKnownTip(entry.entity, entry.entityId, entry.hlc) : Promise.resolve()
        }),
      )
      await removeOperations(pushedIds, database)
    }

    if (pushedIds.length === pending.length) await recordSuccessfulPush(profile.id)

    // Surface a real failure only after the side that succeeded is already
    // durably committed above — the settled rejection here is the *other*
    // entity type's, still queued for the next retry.
    if (movOutcome.status === 'rejected') throw movOutcome.reason
    if (configOutcome.status === 'rejected') throw configOutcome.reason

    useSyncStore.setState({ phase: 'idle' })
  } catch (e) {
    useSyncStore.setState({ phase: 'idle', lastError: e instanceof Error ? e.message : String(e) })
    throw e
  }
}

// --- yearly compaction ---------------------------------------------------
//
// specs.md §10.19: "a closed shard is frozen forever... compaction folds
// only the closing year's own months, and never rewrites an already-closed
// file." Conservative by construction: if any one of this device's own
// monthly files for the year can't be verified, the whole compaction is
// aborted — nothing is deleted on a guess.
//
// The yearly CSV stores category/section *names*, not the ids a Movimiento
// carries (specs.md §10.22) — a file whose whole reason to exist is that a
// person can open it without the app must not hand them `cat_a1b2`. The
// taxonomy therefore comes from the same globally-merged Config the pull
// just replayed, never from a second read that could disagree with it. A
// pull that found no Config at all yields empty tables, and csv.ts already
// falls back to the raw id per column rather than dropping the row.
type CsvTaxonomy = Pick<Config, 'secciones' | 'categorias'>

const csvTaxonomy = (config: Config | undefined): CsvTaxonomy => ({
  secciones: config?.secciones ?? [],
  categorias: config?.categorias ?? [],
})

// The compacted *shard* is scoped to this device's own files (§10.19:
// "exactly one device ever writes any given file") — but the yearly *CSV*
// is not the same file per-device, and must not be built from only this
// device's own year, or two devices that each touched movements in the
// same year would silently overwrite each other's half of the picture the
// next time either compacted (traced while pressure-testing the
// single-writer claim against this exact file — see this track's report).
// The CSV is instead a filtered projection of `allMovimientos` — the full,
// already-globally-merged set `pull()` just computed — so every device
// that happens to write it writes the *same* correct content; a second
// device's write is a harmless, idempotent duplicate, not a conflict.
// (`LEEME.txt` gets the identical treatment for the identical reason: its
// content is deterministic from locale + format version, never
// accumulated per-writer data — so it, too, is a safe exception to the
// single-writer rule rather than a violation of it.)

export const compactYear = async (
  token: string,
  profile: ProfileRecord,
  year: string,
  allMovimientos: readonly Movimiento[],
  taxonomy: CsvTaxonomy,
  locale: SupportedLocale,
): Promise<boolean> => {
  const folderId = profile.driveFolderId ?? (await ensureFolder(token))
  const listing = await listKuroBelloFiles(token, folderId)
  const device = await getDeviceId()

  const ownMonths = listing.filter((f) => {
    const parsed = parseDriveFilename(f.name)
    return (
      parsed.kind === 'mov-month' && parsed.device === device && parsed.periodo?.startsWith(year)
    )
  })
  if (ownMonths.length === 0) return false // nothing to compact yet

  const downloaded = await Promise.all(ownMonths.map((f) => downloadMovFile(token, f.id)))
  if (downloaded.some((d) => d.file === null)) {
    console.warn(
      `sync: could not verify every ${year} shard before compacting — skipping this round`,
    )
    return false
  }
  const files = downloaded.map((d) => d.file) as MovOpFile[]

  const replayed = replayMovimientos(files)
  const compactedOps: MovOpEntry[] = [...replayed.tips].map(([id, tip]) =>
    tip.state === 'alive'
      ? { op: 'put', hlc: tip.hlc, basedOn: tip.basedOn, mov: tip.value }
      : { op: 'del', hlc: tip.hlc, basedOn: tip.basedOn, id },
  )

  const compactedFile: MovOpFile = {
    v: OP_FORMAT_VERSION,
    device,
    periodo: year,
    ops: compactedOps,
  }
  await uploadMovShard(token, folderId, compactedFile)

  // Only now, after the replacement file is confirmed written, delete the
  // months it replaces — and only this device's own.
  await Promise.all(ownMonths.map((f) => deleteFile(token, f.id)))

  const yearItems = allMovimientos.filter((m) => m.fecha.startsWith(year))
  const parts = buildMovimientoCsvParts(yearItems, { locale, ...taxonomy })
  await writeYearlyCsv(token, folderId, year, parts)
  await writeLeeme(token, folderId, locale)

  return true
}

/** Compacts the year before the current one, once — a no-op once this device has no monthly files left for it. Called automatically at the end of a successful pull, best-effort, with that pull's own already-merged `movimientos` (never a second, partial replay). */
export const compactClosedYearsIfNeeded = async (
  token: string,
  profile: ProfileRecord,
  allMovimientos: readonly Movimiento[],
  taxonomy: CsvTaxonomy,
  locale: SupportedLocale,
): Promise<void> => {
  const closedYear = String(Number(currentYear()) - 1)
  await compactYear(token, profile, closedYear, allMovimientos, taxonomy, locale)
}

// --- triggers ------------------------------------------------------------
//
// specs.md §10.19 "When it syncs": push on reconnect/foreground/a debounce
// after a burst of writes/pagehide, only when the outbox is dirty; pull on
// app open and reconnect, as the revision check above. Takes a context
// getter rather than reaching into authStore.ts itself — this module has
// no live caller yet (see the header comment), so it stays decoupled until
// one exists.

export interface SyncContext {
  token: string
  profile: ProfileRecord
  /** The caller's active copy locale — no default here either, same reasoning as `pull`'s own parameter above. */
  locale: SupportedLocale
}

const PUSH_DEBOUNCE_MS = 3_000

export interface SyncTriggerHandle {
  stop: () => void
}

/**
 * Idempotent per handle: call `stop()` before starting a second one in the
 * same tab/test to avoid double-firing. `debounceMs` defaults to the real
 * debounce; tests override it to avoid a real multi-second wait.
 *
 * `getContext` may return a `Promise` — `sync/syncSession.ts`'s real one
 * does, since honoring "the token is refreshed" (specs.md §10.26 §2) means
 * checking `AuthSession.expiresAt` and, if it's stale, awaiting a fresh
 * token before a trigger fires, not just reading whatever's already in
 * memory. A plain synchronous getter (every test in this file) still works
 * unchanged — `await`ing a non-`Promise` resolves it immediately.
 */
export const startSyncTriggers = (
  getContext: () => SyncContext | null | Promise<SyncContext | null>,
  { debounceMs = PUSH_DEBOUNCE_MS }: { debounceMs?: number } = {},
): SyncTriggerHandle => {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const runPush = async (): Promise<void> => {
    const ctx = await getContext()
    if (!ctx) return
    await push(ctx.token, ctx.profile).catch((e: unknown) =>
      console.warn('sync: push trigger failed', e),
    )
    // The outbox-dirty subscription below only reacts to a false→true
    // *edge* — a write enqueued while `dirty` was already true (this push
    // was already in flight) never flips that edge, so it gets no debounce
    // timer of its own and `pushOnce`'s already-captured `pending` snapshot
    // didn't include it either. Re-arming here whenever the outbox is
    // still dirty after an attempt — whether from such a late write or from
    // a partial/failed push — is what actually guarantees "the next
    // trigger picks it up" (specs.md §10.26 §1's own claim for a coalesced
    // call): confirmed missing, and reproduced, before this fix
    // (`sync/engine.test.ts`'s debounce-gap test).
    if (useOutboxStore.getState().dirty) {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => void runPush(), debounceMs)
    }
  }
  const runPull = async (): Promise<void> => {
    const ctx = await getContext()
    if (!ctx) return
    await pull(ctx.token, ctx.profile, ctx.locale).catch((e: unknown) =>
      console.warn('sync: pull trigger failed', e),
    )
  }

  const onOnline = (): void => {
    void runPull()
    if (useOutboxStore.getState().dirty) void runPush()
  }
  const onVisible = (): void => {
    if (document.visibilityState !== 'visible') return
    onOnline()
  }
  const onPageHide = (): void => {
    if (useOutboxStore.getState().dirty) void runPush() // best-effort — specs.md §10.19: the moment is backgrounding, not closing; there is no guaranteed completion here.
  }
  const onOutboxDirty = (dirty: boolean): void => {
    if (!dirty) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void runPush(), debounceMs)
  }

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pagehide', onPageHide)
  const unsubscribeOutbox = useOutboxStore.subscribe((state, prev) => {
    if (state.dirty !== prev.dirty) onOutboxDirty(state.dirty)
  })

  return {
    stop: () => {
      clearTimeout(debounceTimer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onPageHide)
      unsubscribeOutbox()
    },
  }
}
