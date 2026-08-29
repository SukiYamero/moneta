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

interface SyncState {
  phase: 'idle' | 'pulling' | 'pushing'
  pullProgress: { done: number; total: number } | null
  lastError: string | null
  lastPullSummary: PullSummary | null
}

export const useSyncStore = create<SyncState>(() => ({
  phase: 'idle',
  pullProgress: null,
  lastError: null,
  lastPullSummary: null,
}))

export const getSyncIndicator = (): SyncIndicator =>
  deriveSyncIndicator({
    isSyncing: useSyncStore.getState().phase !== 'idle',
    outboxDirty: useOutboxStore.getState().dirty,
  })

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

const materializeConfig = async (
  database: ProfileDb,
  config: Config | undefined,
): Promise<void> => {
  if (!config || config.schemaVersion !== SCHEMA_VERSION) return
  await database.config.put({ ...config, id: CONFIG_ID })
}

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

export interface PullSummary {
  filesReconciled: number
  revivedMovIds: string[]
  skippedEntries: number
}

const DOWNLOADABLE_KINDS = new Set(['mov-month', 'mov-year', 'act', 'config'])

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
          return entry ? recordKnownTip(entry.entity, entry.entityId, entry.hlc) : Promise.resolve()
        }),
      )
      await removeOperations(pushedIds, database)
    }

    if (pushedIds.length === pending.length) await recordSuccessfulPush(profile.id)

    if (movOutcome.status === 'rejected') throw movOutcome.reason
    if (configOutcome.status === 'rejected') throw configOutcome.reason

    useSyncStore.setState({ phase: 'idle' })
  } catch (e) {
    useSyncStore.setState({ phase: 'idle', lastError: e instanceof Error ? e.message : String(e) })
    throw e
  }
}

type CsvTaxonomy = Pick<Config, 'categorias'>

const csvTaxonomy = (config: Config | undefined): CsvTaxonomy => ({
  categorias: config?.categorias ?? [],
})

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
  if (ownMonths.length === 0) return false

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

  await Promise.all(ownMonths.map((f) => deleteFile(token, f.id)))

  const yearItems = allMovimientos.filter((m) => m.fecha.startsWith(year))
  const parts = buildMovimientoCsvParts(yearItems, { locale, ...taxonomy })
  await writeYearlyCsv(token, folderId, year, parts)
  await writeLeeme(token, folderId, locale)

  return true
}

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

export interface SyncContext {
  token: string
  profile: ProfileRecord
  locale: SupportedLocale
}

const PUSH_DEBOUNCE_MS = 6_000

export interface SyncTriggerHandle {
  stop: () => void
}

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
    if (useOutboxStore.getState().dirty) void runPush()
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
