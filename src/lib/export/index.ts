import { format } from 'date-fns'
import { APP_NAME } from '@/lib/branding'
import { buildMovimientoCsvParts } from '@/lib/export/csv'
import { deliverCsv } from '@/lib/export/delivery'
import { getRepo } from '@/lib/repoProvider'
import type { Movimiento } from '@/lib/schema'

export type { CsvExportOptions } from '@/lib/export/csv'
export { buildMovimientoCsvParts } from '@/lib/export/csv'
export type { CsvDelivery } from '@/lib/export/delivery'
export { deliverCsv } from '@/lib/export/delivery'

const PAGE_SIZE = 500

// Paged through the Repo port rather than one unbounded list() call: both
// current implementations answer a limit-less list() with the whole table,
// but the port (repo.ts) makes no such promise, and a future Drive-backed
// Repo is exactly the implementation most likely to cap a single response.
// sortBy/sortDir are fixed across every page — a cursor replayed under a
// different one is rejected as invalid_input (docs/error-handling.md §4),
// so this must stay consistent rather than left to the default.
const fetchAllMovimientos = async (): Promise<Movimiento[]> => {
  const repo = getRepo()
  await repo.ready()
  const all: Movimiento[] = []
  let cursor: string | undefined
  do {
    const page = await repo.movimientos.list({
      limit: PAGE_SIZE,
      cursor,
      sortBy: 'fecha',
      sortDir: 'asc',
    })
    all.push(...page.items)
    // An empty page ends the export even if `nextCursor` is still set: the
    // port (repo.ts) documents no invariant that the last page's cursor is
    // `undefined`, only that both current implementations behave that way —
    // trusting a non-empty cursor alone would spin forever against a future
    // Repo that keeps returning one past the end of the data.
    cursor = page.items.length > 0 ? page.nextCursor : undefined
  } while (cursor !== undefined)
  return all
}

const slug = (value: string): string => value.toLowerCase().replaceAll(/\s+/g, '-')

/** e.g. `"kurobello-movimientos-2026-08-19.csv"` — the filename carries the export date (specs.md §10.12). */
export const buildExportFilename = (date: Date): string =>
  `${slug(APP_NAME)}-movimientos-${format(date, 'yyyy-MM-dd')}.csv`

export interface ExportMovimientosOptions {
  /** Intl tag for the decimal separator — pass `useLocaleFormatting().locale`; no default, same rule as `localeFormatting()`. */
  locale: string
}

/**
 * The entry point stage 3's profile-sheet button calls (specs.md §10.18).
 * Reads through the `Repo` port, so it is unaffected by which
 * implementation is active behind `getRepo()`. No UI trigger yet this wave.
 */
export const exportMovimientosToCsv = async ({
  locale,
}: ExportMovimientosOptions): Promise<void> => {
  const movimientos = await fetchAllMovimientos()
  const parts = buildMovimientoCsvParts(movimientos, { locale })
  await deliverCsv({ filename: buildExportFilename(new Date()), parts })
}
