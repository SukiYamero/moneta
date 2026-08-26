import type { Hlc } from '@/lib/hlc'
import type { Activo, Config, Movimiento } from '@/lib/schema'

export const OP_FORMAT_VERSION = 1

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

export interface ConfigPutOp {
  op: 'put'
  hlc: Hlc
  basedOn: Hlc | null
  config: Config
}
export type ConfigOpEntry = ConfigPutOp

export interface MovOpFile {
  v: number
  device: string
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

export const currentPeriodo = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export const currentYear = (now: Date = new Date()): string => String(now.getFullYear())

export const yearOfPeriodo = (periodo: string): string => periodo.slice(0, 4)

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
