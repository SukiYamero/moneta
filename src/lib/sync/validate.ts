import type {
  Activo,
  Categoria,
  Config,
  Metodo,
  Moneda,
  Movimiento,
  Preferencias,
  TipoActivo,
  TipoMovimiento,
} from '@/lib/schema'
import { CATEGORY_ICON_KEYS, type CategoryIconKey } from '@/lib/categoryIconKeys'
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
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

export const isValidMovimiento = (value: unknown): value is Movimiento => {
  if (!isPlainObject(value)) return false
  if (!isNonEmptyString(value.id)) return false
  if (!isIsoDate(value.fecha)) return false
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
  if (value.capitalInvertido !== undefined && !isFiniteNumber(value.capitalInvertido)) return false
  if (!isFiniteNumber(value.valorActual) || value.valorActual < 0) return false
  if (!isMoneda(value.moneda)) return false
  if (!isIsoDate(value.fechaActualizacion)) return false
  if (value.nota !== undefined && typeof value.nota !== 'string') return false
  if (value.extra !== undefined && !isPlainObject(value.extra)) return false
  return true
}

const CATEGORY_ICON_KEY_SET = new Set<string>(CATEGORY_ICON_KEYS)
const isCategoryIconKey = (value: unknown): value is CategoryIconKey =>
  typeof value === 'string' && CATEGORY_ICON_KEY_SET.has(value)

const ICON_AVATAR_TINT_SET = new Set<string>(ICON_AVATAR_TINTS)
const isIconAvatarTint = (value: unknown): value is IconAvatarTint =>
  typeof value === 'string' && ICON_AVATAR_TINT_SET.has(value)

const sanitizeCategoria = (value: unknown): Categoria | null => {
  if (!isPlainObject(value)) return null
  const { id, nombre, padreId, presupuesto, icono, color, archivado } = value
  if (!isNonEmptyString(id)) return null
  if (!isNonEmptyString(nombre)) return null
  if (presupuesto !== undefined && !isFiniteNumber(presupuesto)) return null
  return {
    id,
    nombre,
    ...(isNonEmptyString(padreId) ? { padreId } : {}),
    ...(isFiniteNumber(presupuesto) ? { presupuesto } : {}),
    ...(isCategoryIconKey(icono) ? { icono } : {}),
    ...(isIconAvatarTint(color) ? { color } : {}),
    ...(typeof archivado === 'boolean' ? { archivado } : {}),
  }
}

const TEMAS = new Set<Preferencias['tema']>(['claro', 'oscuro', 'sistema'])
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

export const sanitizeConfig = (value: unknown): Config | null => {
  if (!isPlainObject(value)) return null
  if (!isFiniteNumber(value.schemaVersion)) return null
  if (!Array.isArray(value.categorias)) return null
  const sanitizedCategorias = value.categorias.map(sanitizeCategoria)
  if (sanitizedCategorias.some((c) => c === null)) return null
  const categorias = sanitizedCategorias.filter((c): c is Categoria => c !== null)
  const preferencias = sanitizePreferencias(value.preferencias)
  if (preferencias === null) return null
  return {
    schemaVersion: value.schemaVersion,
    categorias,
    preferencias,
  }
}

const isValidMovOpEntry = (value: unknown): value is MovOpEntry => {
  if (!isPlainObject(value)) return false
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return false
  if (value.op === 'put') return isValidMovimiento(value.mov)
  if (value.op === 'del') return isNonEmptyString(value.id)
  return false
}

const isValidActOpEntry = (value: unknown): value is ActOpEntry => {
  if (!isPlainObject(value)) return false
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return false
  if (value.op === 'put') return isValidActivo(value.act)
  if (value.op === 'del') return isNonEmptyString(value.id)
  return false
}

const sanitizeConfigOpEntry = (value: unknown): ConfigOpEntry | null => {
  if (!isPlainObject(value)) return null
  if (!isHlc(value.hlc) || !isHlcOrNull(value.basedOn)) return null
  if (value.op !== 'put') return null
  const config = sanitizeConfig(value.config)
  if (!config) return null
  return { op: 'put', hlc: value.hlc, basedOn: value.basedOn, config }
}

const MONTH_PERIODO_RE = /^\d{4}-\d{2}$/
const YEAR_PERIODO_RE = /^\d{4}$/
const isMovPeriodo = (value: unknown): value is string =>
  typeof value === 'string' && (MONTH_PERIODO_RE.test(value) || YEAR_PERIODO_RE.test(value))

export interface ParsedOpFile<T> {
  file: T | null
  skipped: number
}

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
