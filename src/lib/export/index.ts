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
    cursor = page.items.length > 0 ? page.nextCursor : undefined
  } while (cursor !== undefined)
  return all
}

const slug = (value: string): string => value.toLowerCase().replaceAll(/\s+/g, '-')

export const buildExportFilename = (date: Date): string =>
  `${slug(APP_NAME)}-movimientos-${format(date, 'yyyy-MM-dd')}.csv`

export interface ExportMovimientosOptions {
  locale: string
}

export const exportMovimientosToCsv = async ({
  locale,
}: ExportMovimientosOptions): Promise<void> => {
  const repo = getRepo()
  await repo.ready()
  const [movimientos, config] = await Promise.all([fetchAllMovimientos(), repo.getConfig()])
  const parts = buildMovimientoCsvParts(movimientos, {
    locale,
    categorias: config.categorias,
  })
  await deliverCsv({ filename: buildExportFilename(new Date()), parts })
}
