import type { Table } from 'dexie'
import { CONFIG_ID, db, type ConfigRow } from '@/lib/db'
import {
  CONFIG_SEMILLA,
  SCHEMA_VERSION,
  type Activo,
  type Config,
  type Movimiento,
} from '@/lib/schema'
import {
  RepoError,
  type CrudRepo,
  type EntityId,
  type ListQuery,
  type ListResult,
  type Repo,
} from '@/lib/repo'

// --- schemaVersion migration registry -------------------------------------
//
// A migration transforms stored data from `version - 1` to `version`. There
// are none yet at SCHEMA_VERSION 1; the registry exists so a future bump is
// a data-only addition (one entry), never a new branch in `ready()`.
export type Migration = () => Promise<void>

const MIGRATIONS: Record<number, Migration> = {}

// Exported (not part of the frozen `Repo` port) so the dispatch/error
// behaviour is unit-testable independently of the real, currently-empty
// registry above.
export async function migrateSchema(
  fromVersion: number,
  toVersion: number,
  registry: Record<number, Migration>,
): Promise<void> {
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migration = registry[version]
    if (!migration) {
      throw new RepoError(
        `no migration registered to reach schema version ${version}`,
        'schema_mismatch',
      )
    }
    await migration()
  }
}

// --- validation (money) -----------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validateMovimiento(item: Movimiento): void {
  if (!Number.isFinite(item.monto) || item.monto <= 0) {
    throw new RepoError(
      `monto must be a finite, positive number (got ${item.monto})`,
      'invalid_input',
    )
  }
  if (!isValidIsoDate(item.fecha)) {
    throw new RepoError(`fecha must be ISO "yyyy-mm-dd" (got "${item.fecha}")`, 'invalid_input')
  }
  if (!item.moneda) {
    throw new RepoError('moneda is required', 'invalid_input')
  }
}

function validateActivo(item: Activo): void {
  if (!isValidIsoDate(item.fechaActualizacion)) {
    throw new RepoError(
      `fechaActualizacion must be ISO "yyyy-mm-dd" (got "${item.fechaActualizacion}")`,
      'invalid_input',
    )
  }
  if (!item.moneda) {
    throw new RepoError('moneda is required', 'invalid_input')
  }
  if (!Number.isFinite(item.valorActual) || item.valorActual < 0) {
    throw new RepoError(
      `valorActual must be a finite, non-negative number (got ${item.valorActual})`,
      'invalid_input',
    )
  }
}

// --- generic sort/cursor helpers -------------------------------------------

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === undefined || a === null) return -1
  if (b === undefined || b === null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const sa = String(a)
  const sb = String(b)
  if (sa < sb) return -1
  if (sa > sb) return 1
  return 0
}

// `sortDir` applies uniformly across the whole key tuple (primary field,
// tiebreak field, final id fallback) — a full reversal, not just the primary
// field. This is what lets the fast path express the order as a single
// lexicographic range scan over a compound index with `.reverse()`: a
// compound key's tie order flips *entirely* when the traversal direction
// flips, so the comparator has to agree with that or the two disagree on
// which side of a cursor a tied row falls (a real bug this fixed — see
// specs.md §11, 2026-08-18).
function makeComparator<T extends { id: EntityId }>(
  sortBy: keyof T,
  sortDir: 'asc' | 'desc',
  tiebreakField: (keyof T & string) | undefined,
): (a: T, b: T) => number {
  const dirMul = sortDir === 'asc' ? 1 : -1
  return (a, b) => {
    const primary = compareValues(a[sortBy], b[sortBy]) * dirMul
    if (primary !== 0) return primary
    if (tiebreakField) {
      const secondary = compareValues(a[tiebreakField], b[tiebreakField]) * dirMul
      if (secondary !== 0) return secondary
    }
    return compareValues(a.id, b.id) * dirMul
  }
}

interface CursorPayload {
  sortValue: unknown
  tiebreakValue: unknown
  id: EntityId
}

function encodeCursor<T extends { id: EntityId }>(
  item: T,
  sortBy: keyof T,
  tiebreakField: (keyof T & string) | undefined,
): string {
  const payload: CursorPayload = {
    sortValue: item[sortBy],
    tiebreakValue: tiebreakField ? item[tiebreakField] : undefined,
    id: item.id,
  }
  return btoa(encodeURIComponent(JSON.stringify(payload)))
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(cursor))) as Partial<CursorPayload>
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.id !== 'string') {
      throw new Error('malformed cursor payload')
    }
    return { sortValue: parsed.sortValue, tiebreakValue: parsed.tiebreakValue, id: parsed.id }
  } catch (cause) {
    throw new RepoError('invalid pagination cursor', 'invalid_input', { cause })
  }
}

// --- generic CrudRepo<T> factory --------------------------------------------

interface EntityConfig<T extends { id: EntityId }> {
  // Plain `Table` (not `EntityTable`) so the primary-key type is `EntityId`
  // directly instead of dexie's `IDType<T, 'id'>`, which doesn't resolve
  // cleanly against a generic `T` — the two concrete tables are cast in at
  // `createLocalRepo()` below.
  table: Table<T, EntityId, T>
  dateField: keyof T & string
  seccionField: (keyof T & string) | undefined
  tiebreakField: (keyof T & string) | undefined
  // Narrowing index for the in-memory fallback path (`seccion` + date range together).
  compoundIndex: string | undefined
  // Ordering indexes for the fast path: `[dateField+tiebreakField]` (or
  // `[dateField+id]` when there's no separate tiebreak field, since `id` IS
  // the final tiebreak there) and its `seccion`-prefixed counterpart.
  // Compounding the tiebreak into the index means the index's own order
  // already IS the full deterministic sort order `list()` needs — a page
  // reads directly off a bounded cursor instead of sorting the whole
  // matching set in memory.
  fastIndex: string
  fastSeccionIndex: string
  validate: (item: T) => void
}

// A cluster of rows tied on the full (date, tiebreak) key bigger than this
// makes the fast path's bounded read unable to prove it has seen enough
// rows — see the bail-out in `tryFastPath`. Sized generously above any
// realistic same-instant write cluster (e.g. a bulk import sharing one
// `createdAt`); a real table scales in the thousands, so 32 stays a small,
// bounded read even when it fires.
const TIE_SAFETY_MARGIN = 32

function wrapUnknown(error: unknown): never {
  if (error instanceof RepoError) throw error
  throw new RepoError(error instanceof Error ? error.message : String(error), 'unknown', {
    cause: error,
  })
}

function matchesFilters<T>(
  item: T,
  dateField: keyof T & string,
  seccionField: (keyof T & string) | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  seccion: string | undefined,
): boolean {
  if (dateFrom !== undefined && String(item[dateField]) < dateFrom) return false
  if (dateTo !== undefined && String(item[dateField]) > dateTo) return false
  if (seccionField && seccion !== undefined && item[seccionField] !== seccion) return false
  return true
}

function buildCursorItem<T extends { id: EntityId }>(
  payload: CursorPayload,
  sortBy: keyof T,
  tiebreakField: (keyof T & string) | undefined,
): T {
  return {
    [sortBy]: payload.sortValue,
    ...(tiebreakField ? { [tiebreakField]: payload.tiebreakValue } : {}),
    id: payload.id,
  } as T
}

function createCrudRepo<T extends { id: EntityId }>(
  config: EntityConfig<T>,
  ensureReady: () => Promise<void>,
): CrudRepo<T> {
  const {
    table,
    dateField,
    seccionField,
    tiebreakField,
    compoundIndex,
    fastIndex,
    fastSeccionIndex,
    validate,
  } = config

  async function fetchCandidates(
    dateFrom: string | undefined,
    dateTo: string | undefined,
    seccion: string | undefined,
  ): Promise<T[]> {
    const hasDateRange = dateFrom !== undefined || dateTo !== undefined

    if (seccionField && seccion !== undefined && hasDateRange && compoundIndex) {
      const lower: [string, string] = [seccion, dateFrom ?? '']
      const upper: [string, string] = [seccion, dateTo ?? '￿']
      return table.where(compoundIndex).between(lower, upper, true, true).toArray()
    }
    if (seccionField && seccion !== undefined) {
      return table.where(seccionField).equals(seccion).toArray()
    }
    if (hasDateRange) {
      return table
        .where(dateField)
        .between(dateFrom ?? '', dateTo ?? '￿', true, true)
        .toArray()
    }
    return table.toArray()
  }

  // In-memory fallback: materializes every row matching the (index-narrowed)
  // filters, sorts the full set, then slices. Correct for any `sortBy`, but
  // its cost scales with the size of the matching set — the documented
  // exception, used whenever the fast path below doesn't apply.
  async function listSlow(
    dateFrom: string | undefined,
    dateTo: string | undefined,
    seccion: string | undefined,
    sortBy: keyof T,
    sortDir: 'asc' | 'desc',
    limit: number | undefined,
    cursor: string | undefined,
  ): Promise<ListResult<T>> {
    const candidates = await fetchCandidates(dateFrom, dateTo, seccion)
    const filtered = candidates.filter((item) =>
      matchesFilters(item, dateField, seccionField, dateFrom, dateTo, seccion),
    )

    const comparator = makeComparator<T>(sortBy, sortDir, tiebreakField)
    const sorted = filtered.toSorted(comparator)

    let afterCursor = sorted
    if (cursor !== undefined) {
      const cursorItem = buildCursorItem<T>(decodeCursor(cursor), sortBy, tiebreakField)
      afterCursor = sorted.filter((item) => comparator(item, cursorItem) > 0)
    }

    const page = limit !== undefined ? afterCursor.slice(0, limit) : afterCursor
    const hasMore = limit !== undefined && afterCursor.length > page.length
    const lastItem = page[page.length - 1]

    return {
      items: page,
      ...(hasMore && lastItem ? { nextCursor: encodeCursor(lastItem, sortBy, tiebreakField) } : {}),
    }
  }

  // Fast path: only reachable when `sortBy` is the entity's own indexed
  // date field (the default), so `[dateField+tiebreak]` already encodes the
  // exact order `list()` needs. Reads a bounded window straight off that
  // index via `.limit()` instead of materializing the whole matching set —
  // this is what makes `list({ limit: 20 })` on a years-old table cheap.
  //
  // Returns `null` when it can't safely answer (see `TIE_SAFETY_MARGIN`) —
  // the caller falls back to `listSlow`, which is always correct.
  async function tryFastPath(
    dateFrom: string | undefined,
    dateTo: string | undefined,
    seccion: string | undefined,
    sortDir: 'asc' | 'desc',
    limit: number,
    cursor: string | undefined,
  ): Promise<ListResult<T> | null> {
    const useSeccion = seccionField !== undefined && seccion !== undefined
    const indexName = useSeccion ? fastSeccionIndex : fastIndex

    let dateLower = dateFrom ?? ''
    let dateUpper = dateTo ?? '￿'
    let tieLower = ''
    let tieUpper = '￿'

    let cursorItem: T | undefined
    if (cursor !== undefined) {
      const payload = decodeCursor(cursor)
      cursorItem = buildCursorItem<T>(payload, dateField, tiebreakField)
      // Start the range at the cursor's own position, inclusive — narrows
      // the query to exactly what hasn't been returned yet instead of
      // re-walking from the original dateFrom/dateTo edge on every page.
      const tieValue = String(tiebreakField ? payload.tiebreakValue : payload.id)
      if (sortDir === 'desc') {
        dateUpper = String(payload.sortValue)
        tieUpper = tieValue
      } else {
        dateLower = String(payload.sortValue)
        tieLower = tieValue
      }
    }

    const lower = useSeccion ? [seccion, dateLower, tieLower] : [dateLower, tieLower]
    const upper = useSeccion ? [seccion, dateUpper, tieUpper] : [dateUpper, tieUpper]

    const fetchSize = limit + 1 + TIE_SAFETY_MARGIN
    let collection = table.where(indexName).between(lower, upper, true, true)
    if (sortDir === 'desc') collection = collection.reverse()
    const window = await collection.limit(fetchSize).toArray()

    const comparator = makeComparator<T>(dateField, sortDir, tiebreakField)
    const usable = cursorItem
      ? window.filter((item) => comparator(item, cursorItem as T) > 0)
      : window

    if (usable.length < limit + 1 && window.length === fetchSize) {
      // The window was entirely consumed by rows tied with (or before) the
      // cursor and we still can't tell whether more data exists beyond it —
      // an adversarial cluster of same-instant writes bigger than our
      // margin. Bail to the always-correct slow path rather than guess.
      return null
    }

    // Defense in depth, same as `listSlow`: the index bound already
    // enforces this exactly, but re-checking a (small, bounded) window is
    // cheap and keeps the guarantee independent of the bound construction.
    const filtered = usable.filter((item) =>
      matchesFilters(item, dateField, seccionField, dateFrom, dateTo, seccion),
    )
    const page = filtered.slice(0, limit)
    const hasMore = filtered.length > page.length
    const lastItem = page[page.length - 1]

    return {
      items: page,
      ...(hasMore && lastItem
        ? { nextCursor: encodeCursor(lastItem, dateField, tiebreakField) }
        : {}),
    }
  }

  async function list(query: ListQuery<T> = {}): Promise<ListResult<T>> {
    await ensureReady()
    try {
      const { dateFrom, dateTo, seccion, sortDir = 'desc', limit, cursor } = query
      const sortBy = query.sortBy ?? dateField

      if (sortBy === dateField && limit !== undefined) {
        const fast = await tryFastPath(dateFrom, dateTo, seccion, sortDir, limit, cursor)
        if (fast) return fast
      }

      return await listSlow(dateFrom, dateTo, seccion, sortBy, sortDir, limit, cursor)
    } catch (error) {
      wrapUnknown(error)
    }
  }

  async function get(id: EntityId): Promise<T | undefined> {
    await ensureReady()
    try {
      return await table.get(id)
    } catch (error) {
      wrapUnknown(error)
    }
  }

  async function add(item: T): Promise<T> {
    await ensureReady()
    validate(item)
    try {
      const fresh = { ...item }
      await table.add(fresh)
      return fresh
    } catch (error) {
      wrapUnknown(error)
    }
  }

  async function addMany(items: T[]): Promise<T[]> {
    await ensureReady()
    items.forEach(validate)
    try {
      const fresh = items.map((item) => ({ ...item }))
      // All-or-nothing: a dexie transaction throwing inside aborts every
      // write in it, so a bad row in a bulk import never leaves a partial
      // batch committed with no record of which half landed.
      await db.transaction('rw', table, async () => {
        await table.bulkAdd(fresh)
      })
      return fresh
    } catch (error) {
      wrapUnknown(error)
    }
  }

  async function update(id: EntityId, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    await ensureReady()
    try {
      const existing = await table.get(id)
      if (!existing) {
        throw new RepoError(`no ${String(dateField)} entity with id "${id}"`, 'not_found')
      }
      const merged = { ...existing, ...patch, id } as T
      validate(merged)
      await table.put(merged)
      return merged
    } catch (error) {
      wrapUnknown(error)
    }
  }

  async function remove(id: EntityId): Promise<void> {
    await ensureReady()
    try {
      const existing = await table.get(id)
      if (!existing) {
        throw new RepoError(`no entity with id "${id}"`, 'not_found')
      }
      await table.delete(id)
    } catch (error) {
      wrapUnknown(error)
    }
  }

  async function removeMany(ids: EntityId[]): Promise<void> {
    await ensureReady()
    try {
      // Symmetric with `remove`'s not_found guarantee: any missing id aborts
      // the whole batch (transaction throw ⇒ full rollback), never a
      // partial delete.
      await db.transaction('rw', table, async () => {
        for (const id of ids) {
          const existing = await table.get(id)
          if (!existing) {
            throw new RepoError(`no entity with id "${id}"`, 'not_found')
          }
        }
        await table.bulkDelete(ids)
      })
    } catch (error) {
      wrapUnknown(error)
    }
  }

  return { list, get, add, addMany, update, remove, removeMany }
}

// --- ready() / schemaVersion gate -------------------------------------------

async function performReady(): Promise<void> {
  const stored = await db.config.get(CONFIG_ID)

  if (!stored) {
    const seeded: ConfigRow = { ...CONFIG_SEMILLA, id: CONFIG_ID }
    await db.config.put(seeded)
    return
  }

  if (stored.schemaVersion === SCHEMA_VERSION) return

  if (stored.schemaVersion > SCHEMA_VERSION) {
    throw new RepoError(
      `stored data is schema version ${stored.schemaVersion}, newer than this build's ${SCHEMA_VERSION}`,
      'schema_mismatch',
    )
  }

  await migrateSchema(stored.schemaVersion, SCHEMA_VERSION, MIGRATIONS)
  await db.config.update(CONFIG_ID, { schemaVersion: SCHEMA_VERSION })
}

// --- factory -----------------------------------------------------------------

export function createLocalRepo(): Repo {
  // Memoized per repo instance: two concurrent `ready()` callers on the same
  // instance share one in-flight promise, so migrations never run twice. A
  // failed attempt clears the memo so a later retry can re-run it.
  let readyPromise: Promise<void> | null = null

  function ready(): Promise<void> {
    if (!readyPromise) {
      readyPromise = performReady().catch((error: unknown) => {
        readyPromise = null
        throw error instanceof RepoError
          ? error
          : new RepoError(error instanceof Error ? error.message : String(error), 'unknown', {
              cause: error,
            })
      })
    }
    return readyPromise
  }

  const movimientos = createCrudRepo<Movimiento>(
    {
      table: db.movimientos as Table<Movimiento, EntityId, Movimiento>,
      dateField: 'fecha',
      seccionField: 'seccion',
      tiebreakField: 'createdAt',
      compoundIndex: '[seccion+fecha]',
      fastIndex: '[fecha+createdAt]',
      fastSeccionIndex: '[seccion+fecha+createdAt]',
      validate: validateMovimiento,
    },
    ready,
  )

  const activos = createCrudRepo<Activo>(
    {
      table: db.activos as Table<Activo, EntityId, Activo>,
      dateField: 'fechaActualizacion',
      seccionField: 'seccion',
      tiebreakField: undefined,
      compoundIndex: '[seccion+fechaActualizacion]',
      fastIndex: '[fechaActualizacion+id]',
      fastSeccionIndex: '[seccion+fechaActualizacion+id]',
      validate: validateActivo,
    },
    ready,
  )

  async function getConfig(): Promise<Config> {
    await ready()
    const row = await db.config.get(CONFIG_ID)
    if (!row) {
      throw new RepoError('config missing after ready()', 'unknown')
    }
    const { id: _id, ...config } = row
    return config
  }

  async function updateConfig(patch: Partial<Config>): Promise<Config> {
    await ready()
    // schemaVersion is owned by ready()/migrations, never by callers — the
    // `Partial<Config>` patch type structurally allows it, but honoring it
    // (even silently dropping it) would let a caller believe a schema-version
    // write succeeded. Reject it explicitly instead.
    if (patch.schemaVersion !== undefined) {
      throw new RepoError('schemaVersion is not caller-writable via updateConfig', 'invalid_input')
    }
    const existing = await db.config.get(CONFIG_ID)
    if (!existing) {
      throw new RepoError('config missing after ready()', 'unknown')
    }
    const merged: ConfigRow = { ...existing, ...patch, id: CONFIG_ID }
    await db.config.put(merged)
    const { id: _mergedId, ...config } = merged
    return config
  }

  return { ready, movimientos, activos, getConfig, updateConfig }
}
