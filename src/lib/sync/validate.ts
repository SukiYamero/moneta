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
import { CATEGORY_ICON_KEYS, type CategoryIconKey } from '@/lib/categoryIconKeys'
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
// No `src/lib/` runtime list of tint values exists yet (only the type,
// iconAvatarTint.ts) — ICON_AVATAR_TINTS is `Object.keys(TINT_CLASSES)`,
// still the single real source of truth for "every valid tint," so this
// reads it rather than hand-writing a second copy of the nine names.
// tintClasses.ts's only import of IconAvatar.tsx is itself `import type`
// (erased), so this pulls in no lucide-react/JSX — just the string table.
import { ICON_AVATAR_TINTS } from '@/lib/iconAvatarTint'
import { isSupportedLocale } from '@/lib/i18n/resources'
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

const CATEGORY_ICON_KEY_SET = new Set<string>(CATEGORY_ICON_KEYS)
const isCategoryIconKey = (value: unknown): value is CategoryIconKey =>
  typeof value === 'string' && CATEGORY_ICON_KEY_SET.has(value)

const ICON_AVATAR_TINT_SET = new Set<string>(ICON_AVATAR_TINTS)
const isIconAvatarTint = (value: unknown): value is IconAvatarTint =>
  typeof value === 'string' && ICON_AVATAR_TINT_SET.has(value)

/**
 * A sanitizer, not a predicate, unlike every other check in this file:
 * `id`/`nombre`/`seccionId`/`tipo`/`presupuesto` are load-bearing (a
 * categoria failing any of those can't render or total correctly, so it's
 * dropped like everywhere else here), but `icono`/`color` are
 * presentational — specs.md §10.22 already defines a type-based fallback
 * for "no icon/color chosen," and its edge case is explicit that an
 * invalid one "falls back and the record is kept; it is never dropped."
 * A hand-edited Drive file with `color: "purple-ish"` must not delete a
 * category the user created — it degrades to no color chosen instead.
 */
const sanitizeCategoria = (value: unknown): Categoria | null => {
  if (!isPlainObject(value)) return null
  const { id, nombre, seccionId, tipo, presupuesto, icono, color } = value
  if (!isNonEmptyString(id)) return null
  if (!isNonEmptyString(nombre)) return null
  if (!isNonEmptyString(seccionId)) return null
  if (!isTipoMovimiento(tipo)) return null
  if (presupuesto !== undefined && !isFiniteNumber(presupuesto)) return null
  return {
    id,
    nombre,
    seccionId,
    tipo,
    ...(isFiniteNumber(presupuesto) ? { presupuesto } : {}),
    ...(isCategoryIconKey(icono) ? { icono } : {}),
    ...(isIconAvatarTint(color) ? { color } : {}),
  }
}

const TEMAS = new Set<Preferencias['tema']>(['claro', 'oscuro', 'sistema'])
/**
 * A sanitizer, not a predicate — same shape and same reasoning as
 * `sanitizeCategoria` below. `idioma` (specs.md §10.24) is optional and its
 * absence is meaningful: it means "follow the device". An unsupported value
 * from a hand-edited Drive file is therefore stripped, not fatal — stripping
 * it lands the user on exactly the behaviour they would have had without the
 * field, while rejecting the whole config would take their categories and
 * currency down with a bad language tag. The required fields still reject.
 */
const sanitizePreferencias = (value: unknown): Preferencias | null => {
  if (!isPlainObject(value)) return null
  if (!TEMAS.has(value.tema as Preferencias['tema'])) return null
  if (!isMoneda(value.monedaPrincipal)) return null
  if (value.primerDiaSemana !== 0 && value.primerDiaSemana !== 1) return null
  return {
    tema: value.tema as Preferencias['tema'],
    monedaPrincipal: value.monedaPrincipal,
    primerDiaSemana: value.primerDiaSemana,
    ...(isSupportedLocale(value.idioma) ? { idioma: value.idioma } : {}),
  }
}

/**
 * Also a sanitizer rather than a predicate, but only for `icono`/`color`:
 * a category with an invalid core field (`id`/`nombre`/`seccionId`/`tipo`/
 * `presupuesto`) still rejects the *whole* config, exactly as before — this
 * only spares a category whose sole defect is an invalid `icono`/`color`,
 * which comes back with that one field stripped rather than taking the
 * whole file down with it.
 */
export const sanitizeConfig = (value: unknown): Config | null => {
  if (!isPlainObject(value)) return null
  if (!isFiniteNumber(value.schemaVersion)) return null
  if (!Array.isArray(value.secciones) || !value.secciones.every(isSeccion)) return null
  if (!Array.isArray(value.categorias)) return null
  const sanitizedCategorias = value.categorias.map(sanitizeCategoria)
  if (sanitizedCategorias.some((c) => c === null)) return null
  const categorias = sanitizedCategorias.filter((c): c is Categoria => c !== null)
  const preferencias = sanitizePreferencias(value.preferencias)
  if (preferencias === null) return null
  return {
    schemaVersion: value.schemaVersion,
    secciones: value.secciones,
    categorias,
    preferencias,
  }
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

/** Sanitizer, matching `sanitizeConfig` one level up: a `put` whose `config` has one bad category `icono`/`color` yields a corrected entry, not a dropped one. */
const sanitizeConfigOpEntry = (value: unknown): ConfigOpEntry | null => {
  if (!isPlainObject(value)) return null
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return null
  if (value.op !== 'put') return null
  const config = sanitizeConfig(value.config)
  if (!config) return null
  return { op: 'put', hlc: value.hlc, basedOn: value.basedOn, config }
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

/**
 * `skipped` is the count of entries this call dropped — specs.md §12,
 * 2026-08-20: a malformed entry inside an otherwise-good file used to
 * vanish with zero trace, because this module (deliberately pure and
 * silent — see the header comment) had nowhere to put the count. The I/O
 * caller (`driveFiles.ts`) is what logs it; this module only ever reports
 * the number, never a console call of its own. `0` for a whole-file reject
 * too — there is no salvageable per-entry count once the file itself
 * doesn't parse.
 */
export interface ParsedOpFile<T> {
  file: T | null
  skipped: number
}

/** Malformed entries are dropped, not the whole file — a lone bad line must never take a good file down with it. */
export const parseMovOpFile = (value: unknown): ParsedOpFile<MovOpFile> => {
  if (!isPlainObject(value)) return { file: null, skipped: 0 }
  if (!isFiniteNumber(value.v) || value.v > OP_FORMAT_VERSION) return { file: null, skipped: 0 }
  if (!isNonEmptyString(value.device)) return { file: null, skipped: 0 }
  if (!isMovPeriodo(value.periodo)) return { file: null, skipped: 0 }
  if (!Array.isArray(value.ops)) return { file: null, skipped: 0 }
  const ops = value.ops.filter(isValidMovOpEntry)
  return {
    file: { v: value.v, device: value.device, periodo: value.periodo, ops },
    skipped: value.ops.length - ops.length,
  }
}

export const parseActOpFile = (value: unknown): ParsedOpFile<ActOpFile> => {
  if (!isPlainObject(value)) return { file: null, skipped: 0 }
  if (!isFiniteNumber(value.v) || value.v > OP_FORMAT_VERSION) return { file: null, skipped: 0 }
  if (!isNonEmptyString(value.device)) return { file: null, skipped: 0 }
  if (!Array.isArray(value.ops)) return { file: null, skipped: 0 }
  const ops = value.ops.filter(isValidActOpEntry)
  return { file: { v: value.v, device: value.device, ops }, skipped: value.ops.length - ops.length }
}

export const parseConfigOpFile = (value: unknown): ParsedOpFile<ConfigOpFile> => {
  if (!isPlainObject(value)) return { file: null, skipped: 0 }
  if (!isFiniteNumber(value.v) || value.v > OP_FORMAT_VERSION) return { file: null, skipped: 0 }
  if (!isNonEmptyString(value.device)) return { file: null, skipped: 0 }
  if (!Array.isArray(value.ops)) return { file: null, skipped: 0 }
  const ops = value.ops.map(sanitizeConfigOpEntry).filter((op): op is ConfigOpEntry => op !== null)
  return { file: { v: value.v, device: value.device, ops }, skipped: value.ops.length - ops.length }
}
