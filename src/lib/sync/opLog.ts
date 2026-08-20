import type { Hlc } from '@/lib/hlc'
import type { Activo, Config, Movimiento } from '@/lib/schema'

// opLog.ts — the Drive sync format (specs.md §10.19): file shapes, filename
// conventions, and the pure replay/merge engine. No network, no Drive/repo
// import — this module only ever sees op envelopes already parsed into
// memory (validate.ts is what turns untrusted Drive bytes into these types).
//
// "Reading = replay every op from every file in logical order; per id, the
// last one wins" is the whole rule. What follows is that rule made precise
// enough to test: how ops are grouped per id, and the one documented
// exception (a concurrent delete-vs-edit revives).

export const OP_FORMAT_VERSION = 1

// --- op envelopes ------------------------------------------------------

export interface MovPutOp {
  op: 'put'
  hlc: Hlc
  basedOn: Hlc | null
  mov: Movimiento
}
export interface MovDelOp {
  op: 'del'
  hlc: Hlc
  basedOn: Hlc | null
  id: string
}
export type MovOpEntry = MovPutOp | MovDelOp

export interface ActPutOp {
  op: 'put'
  hlc: Hlc
  basedOn: Hlc | null
  act: Activo
}
export interface ActDelOp {
  op: 'del'
  hlc: Hlc
  basedOn: Hlc | null
  id: string
}
export type ActOpEntry = ActPutOp | ActDelOp

// Config has no `del` — specs.md §10.19 only ever describes a config `put`
// (the whole `Config`, the known gap tracked in specs.md §12/§11 rather than
// fixed here — see this track's report).
export interface ConfigPutOp {
  op: 'put'
  hlc: Hlc
  basedOn: Hlc | null
  config: Config
}
export type ConfigOpEntry = ConfigPutOp

// --- op files (one per Drive JSON file) ---------------------------------

export interface MovOpFile {
  v: number
  device: string
  /** `YYYY-MM` for a monthly shard, `YYYY` for a closed-year compaction. */
  periodo: string
  ops: MovOpEntry[]
}
export interface ActOpFile {
  v: number
  device: string
  ops: ActOpEntry[]
}
export interface ConfigOpFile {
  v: number
  device: string
  ops: ConfigOpEntry[]
}

// --- filenames -----------------------------------------------------------
//
// specs.md §10.19's file table. `device` is deviceStore.ts's short,
// filename-safe id (`[0-9a-z]{8}`, but the pattern below is deliberately
// permissive of any lowercase-alphanumeric run so a future longer id still
// round-trips).

const DEVICE_SEGMENT = String.raw`[0-9a-z]+`
const MONTH_SEGMENT = String.raw`\d{4}-\d{2}`
const YEAR_SEGMENT = String.raw`\d{4}`

const MOV_MONTH_RE = new RegExp(`^mov-(${DEVICE_SEGMENT})-(${MONTH_SEGMENT})\\.json$`)
const MOV_YEAR_RE = new RegExp(`^mov-(${DEVICE_SEGMENT})-(${YEAR_SEGMENT})\\.json$`)
const ACT_RE = new RegExp(`^act-(${DEVICE_SEGMENT})\\.json$`)
const CONFIG_RE = new RegExp(`^config-(${DEVICE_SEGMENT})\\.json$`)
const LEEME_FILENAME = 'LEEME.txt'
const CSV_YEAR_RE = /^movimientos-(\d{4})\.csv$/

export const buildMovMonthFilename = (device: string, periodo: string): string =>
  `mov-${device}-${periodo}.json`
export const buildMovYearFilename = (device: string, year: string): string =>
  `mov-${device}-${year}.json`
export const buildActFilename = (device: string): string => `act-${device}.json`
export const buildConfigFilename = (device: string): string => `config-${device}.json`
export const buildYearlyCsvFilename = (year: string): string => `movimientos-${year}.csv`
export const leemeFilename = (): string => LEEME_FILENAME

export type DriveFileKind =
  | 'mov-month'
  | 'mov-year'
  | 'act'
  | 'config'
  | 'csv'
  | 'leeme'
  | 'unknown'

export interface ParsedFilename {
  kind: DriveFileKind
  device?: string
  periodo?: string
}

/**
 * Classifies a filename from a `files.list` response — the transport layer's
 * only way to know what a file *is* before downloading it (specs.md §10.19:
 * "the folder listing is the manifest"). Never throws: an unrecognized name
 * is `kind: 'unknown'`, left alone by every caller (edge cases: "ignored and
 * left untouched, never deleted").
 */
export const parseDriveFilename = (name: string): ParsedFilename => {
  if (name === LEEME_FILENAME) return { kind: 'leeme' }
  const csv = CSV_YEAR_RE.exec(name)
  if (csv) return { kind: 'csv', periodo: csv[1] }
  const month = MOV_MONTH_RE.exec(name)
  if (month) return { kind: 'mov-month', device: month[1], periodo: month[2] }
  const year = MOV_YEAR_RE.exec(name)
  if (year) return { kind: 'mov-year', device: year[1], periodo: year[2] }
  const act = ACT_RE.exec(name)
  if (act) return { kind: 'act', device: act[1] }
  const config = CONFIG_RE.exec(name)
  if (config) return { kind: 'config', device: config[1] }
  return { kind: 'unknown' }
}

// --- periodo helpers -------------------------------------------------------
//
// Shard placement is by *this device's current wall-clock period at write
// time*, never by the movimiento's own `fecha` — the same rule that already
// governs edits ("the op lands in the current shard and wins on replay")
// applies identically to creates and deletes, because a `del` carries no
// `fecha` to place it by (just `{ id }`). Local calendar time, not UTC: this
// is a filename bucket a human never sees misaligned with "this month," and
// since exactly one device ever writes its own file there is no cross-device
// clock-agreement requirement to satisfy.

export const currentPeriodo = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export const currentYear = (now: Date = new Date()): string => String(now.getFullYear())

export const yearOfPeriodo = (periodo: string): string => periodo.slice(0, 4)

// --- generic replay/merge engine -------------------------------------------
//
// One function serves movimientos (grouped by id), activos (grouped by id)
// and config (grouped under one synthetic id — specs.md §12's known gap:
// a config `put` is the whole `Config`, so "merge" is really whole-object
// last-write-wins, same mechanism, deliberately not fixed here).

export const CONFIG_ENTITY_ID = 'config'

interface NormalizedOp<T> {
  op: 'put' | 'del'
  hlc: Hlc
  basedOn: Hlc | null
  id: string
  value?: T
}

export type ReplayState<T> =
  | { state: 'alive'; value: T; hlc: Hlc; basedOn: Hlc | null; revived: boolean }
  | { state: 'deleted'; hlc: Hlc; basedOn: Hlc | null }

/**
 * Per id: sort every op by `hlc` (the total order, identical on every
 * device — hlc.ts's encoding makes `a.hlc < b.hlc` a plain string compare).
 * The last op wins outright *unless* it is a `del` that is concurrent with
 * the `put` immediately before it — "concurrent" meaning the `del` was not
 * based on that `put` (`del.basedOn !== put.hlc`), so the deleting device
 * never saw the edit. Decided (user, 2026-08-19, specs.md §10.19): that
 * specific case revives the record rather than silently discarding the
 * edit. A `put` never needs the same check: last-hlc-wins for two
 * concurrent edits is the documented base rule, with no revival exception —
 * the future "which version?" review screen is what a real three-way
 * conflict needs, not this function (nothing here discards history: every
 * source op is still in its file, this only decides the *projection*).
 */
export const replayEntity = <T>(ops: readonly NormalizedOp<T>[]): Map<string, ReplayState<T>> => {
  const byId = new Map<string, NormalizedOp<T>[]>()
  for (const entry of ops) {
    const bucket = byId.get(entry.id)
    if (bucket) bucket.push(entry)
    else byId.set(entry.id, [entry])
  }

  const result = new Map<string, ReplayState<T>>()
  for (const [id, entries] of byId) {
    const sorted = entries.toSorted((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0))
    const last = sorted.at(-1)
    if (!last) continue

    if (last.op === 'put') {
      result.set(id, {
        state: 'alive',
        value: last.value as T,
        hlc: last.hlc,
        basedOn: last.basedOn,
        revived: false,
      })
      continue
    }

    const prev = sorted.at(-2)
    const concurrentEditVsDelete =
      prev !== undefined && prev.op === 'put' && last.basedOn !== prev.hlc
    if (concurrentEditVsDelete && prev) {
      result.set(id, {
        state: 'alive',
        value: prev.value as T,
        hlc: prev.hlc,
        basedOn: prev.basedOn,
        revived: true,
      })
    } else {
      result.set(id, { state: 'deleted', hlc: last.hlc, basedOn: last.basedOn })
    }
  }
  return result
}

export interface MovReplayResult {
  items: Movimiento[]
  revivedIds: string[]
  /** id → the winning op's hlc/basedOn/state, kept for the sync tip cache and compaction — never persisted onto `Movimiento` itself (schema.ts stays untouched). */
  tips: Map<string, ReplayState<Movimiento>>
}

const normalizeMovOps = (files: readonly MovOpFile[]): NormalizedOp<Movimiento>[] =>
  files.flatMap((file) =>
    file.ops.map(
      (entry): NormalizedOp<Movimiento> =>
        entry.op === 'put'
          ? {
              op: 'put',
              hlc: entry.hlc,
              basedOn: entry.basedOn,
              id: entry.mov.id,
              value: entry.mov,
            }
          : { op: 'del', hlc: entry.hlc, basedOn: entry.basedOn, id: entry.id },
    ),
  )

export const replayMovimientos = (files: readonly MovOpFile[]): MovReplayResult => {
  const tips = replayEntity(normalizeMovOps(files))
  const items: Movimiento[] = []
  const revivedIds: string[] = []
  for (const [id, tip] of tips) {
    if (tip.state === 'alive') {
      items.push(tip.value)
      if (tip.revived) revivedIds.push(id)
    }
  }
  return { items, revivedIds, tips }
}

export interface ActReplayResult {
  items: Activo[]
  revivedIds: string[]
  tips: Map<string, ReplayState<Activo>>
}

const normalizeActOps = (files: readonly ActOpFile[]): NormalizedOp<Activo>[] =>
  files.flatMap((file) =>
    file.ops.map(
      (entry): NormalizedOp<Activo> =>
        entry.op === 'put'
          ? {
              op: 'put',
              hlc: entry.hlc,
              basedOn: entry.basedOn,
              id: entry.act.id,
              value: entry.act,
            }
          : { op: 'del', hlc: entry.hlc, basedOn: entry.basedOn, id: entry.id },
    ),
  )

export const replayActivos = (files: readonly ActOpFile[]): ActReplayResult => {
  const tips = replayEntity(normalizeActOps(files))
  const items: Activo[] = []
  const revivedIds: string[] = []
  for (const [id, tip] of tips) {
    if (tip.state === 'alive') {
      items.push(tip.value)
      if (tip.revived) revivedIds.push(id)
    }
  }
  return { items, revivedIds, tips }
}

export interface ConfigReplayResult {
  config: Config | undefined
  tip: ReplayState<Config> | undefined
}

const normalizeConfigOps = (files: readonly ConfigOpFile[]): NormalizedOp<Config>[] =>
  files.flatMap((file) =>
    file.ops.map(
      (entry): NormalizedOp<Config> => ({
        op: 'put',
        hlc: entry.hlc,
        basedOn: entry.basedOn,
        id: CONFIG_ENTITY_ID,
        value: entry.config,
      }),
    ),
  )

export const replayConfig = (files: readonly ConfigOpFile[]): ConfigReplayResult => {
  const tips = replayEntity(normalizeConfigOps(files))
  const tip = tips.get(CONFIG_ENTITY_ID)
  return { config: tip?.state === 'alive' ? tip.value : undefined, tip }
}
