import type { Categoria, Movimiento, Seccion } from '@/lib/schema'

const COLUMNS = [
  'id',
  'fecha',
  'seccion',
  'categoria',
  'tipo',
  'monto',
  'moneda',
  'metodo',
  'nota',
  'createdAt',
] as const

type Column = (typeof COLUMNS)[number]

const FIELD_SEPARATOR = ';'
const ROW_SEPARATOR = '\r\n'
const BOM = '\uFEFF'
const SEP_HINT_LINE = `sep=${FIELD_SEPARATOR}`

const CHUNK_SIZE = 500

const INJECTION_PREFIX_RE = /^[=+\-@]/
const NEEDS_QUOTING_RE = new RegExp(`["\r\n${FIELD_SEPARATOR}]`)

// A field starting with =, +, - or @ is executed as a formula by Excel/Sheets;
// prefixing it with ' makes them render the cell as text instead.
const escapeFormulaInjection = (value: string): string =>
  INJECTION_PREFIX_RE.test(value) ? `'${value}` : value

const quoteIfNeeded = (value: string): string =>
  NEEDS_QUOTING_RE.test(value) ? `"${value.replaceAll('"', '""')}"` : value

const encodeField = (value: string): string => quoteIfNeeded(escapeFormulaInjection(value))

const createMontoFormatter = (locale: string): Intl.NumberFormat =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 })

const buildRow = (
  movimiento: Movimiento,
  formatMonto: (value: number) => string,
  seccionNameById: Map<string, string>,
  categoriaNameById: Map<string, string>,
): string => {
  const values: Record<Column, string> = {
    id: movimiento.id,
    fecha: movimiento.fecha,
    seccion: seccionNameById.get(movimiento.seccion) ?? movimiento.seccion,
    categoria: categoriaNameById.get(movimiento.categoria) ?? movimiento.categoria,
    tipo: movimiento.tipo,
    monto: formatMonto(movimiento.monto),
    moneda: movimiento.moneda,
    metodo: movimiento.metodo ?? '',
    nota: movimiento.nota ?? '',
    createdAt: movimiento.createdAt,
  }
  return COLUMNS.map((column) => encodeField(values[column])).join(FIELD_SEPARATOR)
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export interface CsvExportOptions {
  locale: string
  secciones: readonly Pick<Seccion, 'id' | 'nombre'>[]
  categorias: readonly Pick<Categoria, 'id' | 'nombre'>[]
}

export const buildMovimientoCsvParts = (
  movimientos: readonly Movimiento[],
  { locale, secciones, categorias }: CsvExportOptions,
): string[] => {
  const formatMonto = createMontoFormatter(locale).format
  const seccionNameById = new Map(secciones.map((s) => [s.id, s.nombre]))
  const categoriaNameById = new Map(categorias.map((c) => [c.id, c.nombre]))
  const header = COLUMNS.map((column) => encodeField(column)).join(FIELD_SEPARATOR)
  const preamble = `${BOM}${SEP_HINT_LINE}${ROW_SEPARATOR}${header}${ROW_SEPARATOR}`
  const rowChunks = chunk(movimientos, CHUNK_SIZE).map(
    (batch) =>
      batch
        .map((item) => buildRow(item, formatMonto, seccionNameById, categoriaNameById))
        .join(ROW_SEPARATOR) + ROW_SEPARATOR,
  )
  return [preamble, ...rowChunks]
}
