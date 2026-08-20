import { create } from 'zustand'
import { findFile, getLastKnownServerTime, type DriveFileListing } from '@/lib/drive'
import { getDeviceId } from '@/lib/deviceStore'
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
}

export const useSyncStore = create<SyncState>(() => ({
  phase: 'idle',
  pullProgress: null,
  lastError: null,
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
}

const DOWNLOADABLE_KINDS = new Set(['mov-month', 'mov-year', 'act', 'config'])

/**
 * `files.list` revision check, download only what changed (cached raw
 * files fill in the rest — see `deviceStore.ts`'s `syncFileCache`), replay,
 * materialize into the local db, then the watermark and the local clock
 * both learn what this pull taught them.
 */
export const pull = async (token: string, profile: ProfileRecord): Promise<PullSummary> => {
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

    for (const { listing, parsed } of candidates) {
      const file = await resolveFile(token, listing, parsed.kind)
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
    const pending = await listPendingOperations()
    movFiles.push(pendingMovFile(pending, device))
    configFiles.push(pendingConfigFile(pending, device))

    const movResult = replayMovimientos(movFiles)
    const actResult = replayActivos(actFiles)
    const configResult = replayConfig(configFiles)

    const database = getProfileDatabase(profile.databaseName)
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
    useSyncStore.setState({ phase: 'idle', pullProgress: null })

    void compactClosedYearsIfNeeded(token, profile, movResult.items).catch((e: unknown) =>
      console.warn('sync: compaction check failed, will retry on the next pull', e),
    )

    return { filesReconciled: candidates.length, revivedMovIds: movResult.revivedIds }
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
): Promise<MovOpFile | ActOpFile | ConfigOpFile | null> => {
  const { deviceDb } = await import('@/lib/deviceStore')
  let cached: { modifiedTime: string; file: unknown } | undefined
  try {
    cached = await deviceDb.syncFileCache.get(listing.id)
  } catch (e) {
    console.warn(`sync: could not read the file cache for ${listing.name}, re-downloading`, e)
  }
  if (cached && cached.modifiedTime === listing.modifiedTime) {
    return cached.file as MovOpFile | ActOpFile | ConfigOpFile | null
  }

  const file =
    kind === 'mov-month' || kind === 'mov-year'
      ? await downloadMovFile(token, listing.id)
      : kind === 'act'
        ? await downloadActFile(token, listing.id)
        : await downloadConfigFile(token, listing.id)

  try {
    await deviceDb.syncFileCache.put({ id: listing.id, modifiedTime: listing.modifiedTime, file })
  } catch (e) {
    console.warn(`sync: could not cache ${listing.name}, will re-download next pull`, e)
  }
  return file
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
    const existing = await downloadMovFile(token, existingId)
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
    const existing = await downloadConfigFile(token, existingId)
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

/** Pushes every currently-pending outbox op. A no-op when the outbox is empty — the dirty flag is what keeps a reconnect free when there is nothing to send. */
export const push = async (token: string, profile: ProfileRecord): Promise<void> => {
  const pending = await listPendingOperations()
  if (pending.length === 0) return

  useSyncStore.setState({ phase: 'pushing', lastError: null })
  try {
    const folderId = profile.driveFolderId ?? (await ensureFolder(token))
    if (profile.driveFolderId !== folderId) await setDriveFolderId(profile.id, folderId)
    const device = await getDeviceId()

    const movEntries = pending.filter((e) => e.entity === 'movimiento')
    const configEntries = pending.filter((e) => e.entity === 'config')

    const [pushedMovIds, pushedConfigIds] = await Promise.all([
      pushMovShard(token, folderId, device, movEntries),
      pushConfig(token, device, configEntries),
    ])
    const pushedIds = [...pushedMovIds, ...pushedConfigIds]

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
      await removeOperations(pushedIds)
    }

    if (pushedIds.length === pending.length) await recordSuccessfulPush(profile.id)
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
  locale: SupportedLocale = 'en',
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
  if (downloaded.some((f) => f === null)) {
    console.warn(
      `sync: could not verify every ${year} shard before compacting — skipping this round`,
    )
    return false
  }
  const files = downloaded as MovOpFile[]

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
  const parts = buildMovimientoCsvParts(yearItems, { locale })
  await writeYearlyCsv(token, folderId, year, parts)
  await writeLeeme(token, folderId, locale)

  return true
}

/** Compacts the year before the current one, once — a no-op once this device has no monthly files left for it. Called automatically at the end of a successful pull, best-effort, with that pull's own already-merged `movimientos` (never a second, partial replay). */
export const compactClosedYearsIfNeeded = async (
  token: string,
  profile: ProfileRecord,
  allMovimientos: readonly Movimiento[],
): Promise<void> => {
  const closedYear = String(Number(currentYear()) - 1)
  await compactYear(token, profile, closedYear, allMovimientos)
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
}

const PUSH_DEBOUNCE_MS = 3_000

export interface SyncTriggerHandle {
  stop: () => void
}

/** Idempotent per handle: call `stop()` before starting a second one in the same tab/test to avoid double-firing. `debounceMs` defaults to the real debounce; tests override it to avoid a real multi-second wait. */
export const startSyncTriggers = (
  getContext: () => SyncContext | null,
  { debounceMs = PUSH_DEBOUNCE_MS }: { debounceMs?: number } = {},
): SyncTriggerHandle => {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const runPush = (): void => {
    const ctx = getContext()
    if (!ctx) return
    push(ctx.token, ctx.profile).catch((e: unknown) => console.warn('sync: push trigger failed', e))
  }
  const runPull = (): void => {
    const ctx = getContext()
    if (!ctx) return
    pull(ctx.token, ctx.profile).catch((e: unknown) => console.warn('sync: pull trigger failed', e))
  }

  const onOnline = (): void => {
    runPull()
    if (useOutboxStore.getState().dirty) runPush()
  }
  const onVisible = (): void => {
    if (document.visibilityState !== 'visible') return
    onOnline()
  }
  const onPageHide = (): void => {
    if (useOutboxStore.getState().dirty) runPush() // best-effort — specs.md §10.19: the moment is backgrounding, not closing; there is no guaranteed completion here.
  }
  const onOutboxDirty = (dirty: boolean): void => {
    if (!dirty) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(runPush, debounceMs)
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
