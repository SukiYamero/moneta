import type {
  Activo,
  Categoria,
  Config,
  Metodo,
  Moneda,
  Movimiento,
  Preferencias,
  Seccion,
  TipoActivo,
  TipoMovimiento,
} from '@/lib/schema'
import {
  OP_FORMAT_VERSION,
  type ActOpEntry,
  type ActOpFile,
  type ConfigOpEntry,
  type ConfigOpFile,
  type MovOpEntry,
  type MovOpFile,
} from '@/lib/sync/opLog'

// validate.ts — turns untrusted Drive bytes into opLog.ts's types, or
// rejects them. specs.md §10.19's edge cases, restated as code: "everything
// read from Drive is untrusted input" — the user's own Drive, a visible
// folder, plain JSON they can hand-edit, truncate, or half-write. drive.ts's
// `readJsonFile<T>` casts, it does not check; every function here is that
// check. Pure and silent on purpose (no console.* here) — callers are I/O
// code that already knows *which* file/entry it was reading, so they are
// the ones positioned to log a useful "skipping X" warning per
// docs/error-handling.md's "never silent" rule. This module only ever
// answers "is this shaped right," never "should we act on it."
//
// Granularity matters: a malformed *entry* degrades to skipping that one
// entry, not the whole file (an unrelated valid `put` two lines later must
// still replay) — a malformed *file* (not even an object, `ops` not an
// array, or a newer `v`) degrades to skipping the whole file, since there is
// nothing safe to salvage from it. A truncated download (valid JSON syntax
// cut short mid-file, or simply not valid JSON at all) is caught by
// `JSON.parse` itself upstream in the transport layer, never here — by the
// time a value reaches this module it has already parsed as *some* JSON
// value; this module only judges its shape.

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Matches hlc.ts's own encoding exactly: 9-char millis, 4-char counter, both
// base36, then the device id segment. An hlc this build never produced
// (wrong width, uppercase, an extra segment) is exactly the kind of
// hand-edited-file input the edge cases call out — reject it rather than
// let a malformed sort key silently corrupt the total order.
const HLC_RE = /^[0-9a-z]{9}-[0-9a-z]{4}-[0-9a-z]+$/
const isHlc = (value: unknown): value is string => typeof value === 'string' && HLC_RE.test(value)
const isHlcOrNull = (value: unknown): value is string | null => value === null || isHlc(value)

const MONEDAS = new Set<Moneda>(['COP', 'USD', 'MXN', 'ARS', 'BRL', 'PEN'])
const isMoneda = (value: unknown): value is Moneda => MONEDAS.has(value as Moneda)

const METODOS = new Set<Metodo>(['efectivo', 'debito', 'credito', 'banco'])
const isMetodo = (value: unknown): value is Metodo => METODOS.has(value as Metodo)

const TIPOS_MOVIMIENTO = new Set<TipoMovimiento>(['ingreso', 'gasto'])
const isTipoMovimiento = (value: unknown): value is TipoMovimiento =>
  TIPOS_MOVIMIENTO.has(value as TipoMovimiento)

const TIPOS_ACTIVO = new Set<TipoActivo>([
  'CDT',
  'FIC',
  'cuenta_alto_rendimiento',
  'acciones',
  'cripto',
  'bonos',
  'inmueble',
  'otro',
])
const isTipoActivo = (value: unknown): value is TipoActivo => TIPOS_ACTIVO.has(value as TipoActivo)

/** Shape only — `schema.ts`'s own field-level rules (monto > 0, etc.) are re-checked once the record lands in `repo.local.ts`'s `add`/`update` on replay-into-dexie, so this stays permissive on business rules and strict on types. */
export const isValidMovimiento = (value: unknown): value is Movimiento => {
  if (!isPlainObject(value)) return false
  if (!isNonEmptyString(value.id)) return false
  if (!isIsoDate(value.fecha)) return false
  if (!isNonEmptyString(value.seccion)) return false
  if (!isNonEmptyString(value.categoria)) return false
  if (!isTipoMovimiento(value.tipo)) return false
  if (!isFiniteNumber(value.monto) || value.monto <= 0) return false
  if (!isMoneda(value.moneda)) return false
  if (value.metodo !== undefined && !isMetodo(value.metodo)) return false
  if (value.nota !== undefined && typeof value.nota !== 'string') return false
  if (!isNonEmptyString(value.createdAt)) return false
  if (value.extra !== undefined && !isPlainObject(value.extra)) return false
  return true
}

export const isValidActivo = (value: unknown): value is Activo => {
  if (!isPlainObject(value)) return false
  if (!isNonEmptyString(value.id)) return false
  if (!isNonEmptyString(value.nombre)) return false
  if (!isTipoActivo(value.tipo)) return false
  if (value.seccion !== undefined && typeof value.seccion !== 'string') return false
  if (value.capitalInvertido !== undefined && !isFiniteNumber(value.capitalInvertido)) return false
  if (!isFiniteNumber(value.valorActual) || value.valorActual < 0) return false
  if (!isMoneda(value.moneda)) return false
  if (!isIsoDate(value.fechaActualizacion)) return false
  if (value.nota !== undefined && typeof value.nota !== 'string') return false
  if (value.extra !== undefined && !isPlainObject(value.extra)) return false
  return true
}

const isSeccion = (value: unknown): value is Seccion =>
  isPlainObject(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.nombre) &&
  isFiniteNumber(value.orden)

const isCategoria = (value: unknown): value is Categoria =>
  isPlainObject(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.nombre) &&
  isNonEmptyString(value.seccionId) &&
  isTipoMovimiento(value.tipo) &&
  (value.presupuesto === undefined || isFiniteNumber(value.presupuesto))

const TEMAS = new Set<Preferencias['tema']>(['claro', 'oscuro', 'sistema'])
const isPreferencias = (value: unknown): value is Preferencias =>
  isPlainObject(value) &&
  TEMAS.has(value.tema as Preferencias['tema']) &&
  isMoneda(value.monedaPrincipal) &&
  (value.primerDiaSemana === 0 || value.primerDiaSemana === 1)

export const isValidConfig = (value: unknown): value is Config => {
  if (!isPlainObject(value)) return false
  if (!isFiniteNumber(value.schemaVersion)) return false
  if (!Array.isArray(value.secciones) || !value.secciones.every(isSeccion)) return false
  if (!Array.isArray(value.categorias) || !value.categorias.every(isCategoria)) return false
  if (!isPreferencias(value.preferencias)) return false
  return true
}

// --- op entries --------------------------------------------------------

const isValidMovOpEntry = (value: unknown): value is MovOpEntry => {
  if (!isPlainObject(value)) return false
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return false
  if (value.op === 'put') return isValidMovimiento(value.mov)
  if (value.op === 'del') return isNonEmptyString(value.id)
  return false // unknown `op` — edge case: ignored, never a thrown boot
}

const isValidActOpEntry = (value: unknown): value is ActOpEntry => {
  if (!isPlainObject(value)) return false
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return false
  if (value.op === 'put') return isValidActivo(value.act)
  if (value.op === 'del') return isNonEmptyString(value.id)
  return false
}

const isValidConfigOpEntry = (value: unknown): value is ConfigOpEntry => {
  if (!isPlainObject(value)) return false
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return false
  return value.op === 'put' && isValidConfig(value.config)
}

// --- op files ------------------------------------------------------------
//
// `v > OP_FORMAT_VERSION` (a file written by a newer app build) fails the
// whole file, per the edge cases: "a file whose schemaVersion is newer than
// this build" degrades to skip-the-file, never a thrown boot. `v` below
// `OP_FORMAT_VERSION` is accepted as-is — there is no prior version to
// migrate from yet (OP_FORMAT_VERSION started at 1), the same "nothing to
// migrate yet" posture `repo.local.ts`'s empty `MIGRATIONS` registry takes.

const MONTH_PERIODO_RE = /^\d{4}-\d{2}$/
const YEAR_PERIODO_RE = /^\d{4}$/
const isMovPeriodo = (value: unknown): value is string =>
  typeof value === 'string' && (MONTH_PERIODO_RE.test(value) || YEAR_PERIODO_RE.test(value))

/** Malformed entries are dropped, not the whole file — a lone bad line must never take a good file down with it. */
export const parseMovOpFile = (value: unknown): MovOpFile | null => {
  if (!isPlainObject(value)) return null
  if (!isFiniteNumber(value.v) || value.v > OP_FORMAT_VERSION) return null
  if (!isNonEmptyString(value.device)) return null
  if (!isMovPeriodo(value.periodo)) return null
  if (!Array.isArray(value.ops)) return null
  const ops = value.ops.filter(isValidMovOpEntry)
  return { v: value.v, device: value.device, periodo: value.periodo, ops }
}

export const parseActOpFile = (value: unknown): ActOpFile | null => {
  if (!isPlainObject(value)) return null
  if (!isFiniteNumber(value.v) || value.v > OP_FORMAT_VERSION) return null
  if (!isNonEmptyString(value.device)) return null
  if (!Array.isArray(value.ops)) return null
  const ops = value.ops.filter(isValidActOpEntry)
  return { v: value.v, device: value.device, ops }
}

export const parseConfigOpFile = (value: unknown): ConfigOpFile | null => {
  if (!isPlainObject(value)) return null
  if (!isFiniteNumber(value.v) || value.v > OP_FORMAT_VERSION) return null
  if (!isNonEmptyString(value.device)) return null
  if (!Array.isArray(value.ops)) return null
  const ops = value.ops.filter(isValidConfigOpEntry)
  return { v: value.v, device: value.device, ops }
}
