import type { Movimiento } from '@/lib/schema'

// Header row is the schema field names, not localized labels (AGENTS.md:
// they're the real Drive column contract) — stable across locales, and a
// re-import elsewhere keeps meaning the same thing. `extra` is deliberately
// excluded: it's schema.ts's escape hatch for fields not yet promoted to a
// real column, not a stable column itself, and its shape isn't uniform
// across rows.
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

// Rows are built and joined in bounded batches, never accumulated with one
// running `+=` across the whole dataset, and returned as separate string
// parts (see buildMovimientoCsvParts) so a caller can hand them straight to
// `new Blob(parts)` without ever forming one giant in-memory string for a
// large export (specs.md §10.12: "build the file in chunks").
const CHUNK_SIZE = 500

const INJECTION_PREFIX_RE = /^[=+\-@]/
const NEEDS_QUOTING_RE = new RegExp(`["\r\n${FIELD_SEPARATOR}]`)

/**
 * A field whose value starts with `=`, `+`, `-` or `@` is executed as a
 * formula by Excel/Sheets. `nota` and category/section names are free text
 * the user writes, so this is reachable (specs.md §10.12 hazard 4) — a
 * security issue, not a formatting nit. Prefixing with `'` makes
 * Excel/Sheets render the cell as text. Applied to every column uniformly,
 * not only the free-text ones: a future column staying safe shouldn't
 * depend on remembering which fields were "the risky ones."
 */
const escapeFormulaInjection = (value: string): string =>
  INJECTION_PREFIX_RE.test(value) ? `'${value}` : value

const quoteIfNeeded = (value: string): string =>
  NEEDS_QUOTING_RE.test(value) ? `"${value.replaceAll('"', '""')}"` : value

const encodeField = (value: string): string => quoteIfNeeded(escapeFormulaInjection(value))

/**
 * `useGrouping: false` — a thousands separator is one more punctuation mark
 * to reason about for no benefit here (this is a data file, not a display
 * label), and it removes any doubt about which locale's grouping character
 * might appear next to the `;` field separator (specs.md §10.12 hazard 3).
 * `maximumFractionDigits: 20` (Intl's own ceiling) instead of the default 3:
 * this is a data export, not a currency label, so it must preserve the
 * exact stored value rather than rounding it — only the decimal *mark*
 * should come from the locale, never the precision.
 */
const createMontoFormatter = (locale: string): Intl.NumberFormat =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 })

const buildRow = (movimiento: Movimiento, formatMonto: (value: number) => string): string => {
  const values: Record<Column, string> = {
    id: movimiento.id,
    fecha: movimiento.fecha,
    seccion: movimiento.seccion,
    categoria: movimiento.categoria,
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
  /** Intl tag, e.g. `useLocaleFormatting().locale` — never a hand-rolled default. */
  locale: string
}

/**
 * Pure serialisation: `Movimiento[]` → CSV file, as an array of string
 * parts. No repo/store/UI import, no platform branching (see delivery.ts).
 * An empty `movimientos` array produces a header-only file, not an error.
 * Dates pass through as the stored ISO `yyyy-mm-dd`/ISO datetime — no
 * reformatting.
 */
export const buildMovimientoCsvParts = (
  movimientos: readonly Movimiento[],
  { locale }: CsvExportOptions,
): string[] => {
  const formatMonto = createMontoFormatter(locale).format
  const header = COLUMNS.map((column) => encodeField(column)).join(FIELD_SEPARATOR)
  const preamble = `${BOM}${SEP_HINT_LINE}${ROW_SEPARATOR}${header}${ROW_SEPARATOR}`
  const rowChunks = chunk(movimientos, CHUNK_SIZE).map(
    (batch) => batch.map((item) => buildRow(item, formatMonto)).join(ROW_SEPARATOR) + ROW_SEPARATOR,
  )
  return [preamble, ...rowChunks]
}
