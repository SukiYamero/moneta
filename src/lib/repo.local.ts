import type { Table } from 'dexie'
import { CONFIG_ID, db, type ConfigRow, type ProfileDb } from '@/lib/db'
import { buildSeedConfig } from '@/lib/seedConfig'
import { SCHEMA_VERSION, type Activo, type Config, type Movimiento } from '@/lib/schema'
import {
  RepoError,
  type CrudRepo,
  type EntityId,
  type ListQuery,
  type ListResult,
  type Repo,
} from '@/lib/repo'

export type Migration = () => Promise<void>

const MIGRATIONS: Record<number, Migration> = {}

export const migrateSchema = async (
  fromVersion: number,
  toVersion: number,
  registry: Record<number, Migration>,
): Promise<void> => {
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_RE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const validateMovimiento = (item: Movimiento): void => {
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

const validateActivo = (item: Activo): void => {
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

const compareValues = (a: unknown, b: unknown): number => {
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

const makeComparator = <T extends { id: EntityId }>(
  sortBy: keyof T,
  sortDir: 'asc' | 'desc',
  tiebreakField: (keyof T & string) | undefined,
): ((a: T, b: T) => number) => {
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
  sortBy: string
  sortDir: 'asc' | 'desc'
  sortValue: unknown
  tiebreakValue: unknown
  id: EntityId
}

const encodeCursor = <T extends { id: EntityId }>(
  item: T,
  sortBy: keyof T,
  sortDir: 'asc' | 'desc',
  tiebreakField: (keyof T & string) | undefined,
): string => {
  const payload: CursorPayload = {
    sortBy: String(sortBy),
    sortDir,
    sortValue: item[sortBy],
    tiebreakValue: tiebreakField ? item[tiebreakField] : undefined,
    id: item.id,
  }
  return btoa(encodeURIComponent(JSON.stringify(payload)))
}

const decodeCursor = (cursor: string, sortBy: string, sortDir: 'asc' | 'desc'): CursorPayload => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(cursor))) as Partial<CursorPayload>
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.id !== 'string' ||
      typeof parsed.sortBy !== 'string' ||
      (parsed.sortDir !== 'asc' && parsed.sortDir !== 'desc')
    ) {
      throw new Error('malformed cursor payload')
    }
    if (parsed.sortBy !== sortBy || parsed.sortDir !== sortDir) {
      throw new Error(
        `cursor was minted for sortBy="${parsed.sortBy}"/sortDir="${parsed.sortDir}", ` +
          `not the current sortBy="${sortBy}"/sortDir="${sortDir}"`,
      )
    }
    return {
      sortBy: parsed.sortBy,
      sortDir: parsed.sortDir,
      sortValue: parsed.sortValue,
      tiebreakValue: parsed.tiebreakValue,
      id: parsed.id,
    }
  } catch (cause) {
    throw new RepoError('invalid pagination cursor', 'invalid_input', { cause })
  }
}

const validateLimit = (limit: number | undefined): void => {
  if (limit === undefined) return
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RepoError(`limit must be a positive integer (got ${limit})`, 'invalid_input')
  }
}

interface EntityConfig<T extends { id: EntityId }> {
  table: Table<T, EntityId, T>
  dateField: keyof T & string
  tiebreakField: (keyof T & string) | undefined
  fastIndex: string
  validate: (item: T) => void
  entityLabel: string
}

const TIE_SAFETY_MARGIN = 32

const wrapUnknown = (error: unknown): never => {
  if (error instanceof RepoError) throw error
  throw new RepoError(error instanceof Error ? error.message : String(error), 'unknown', {
    cause: error,
  })
}

const hasErrorName = (error: unknown, name: string): boolean => {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === name
}

const isConstraintError = (error: unknown): boolean => {
  return hasErrorName(error, 'ConstraintError')
}

const hasConstraintFailure = (error: unknown): boolean => {
  if (!hasErrorName(error, 'BulkError')) return false
  const failures = (error as { failures?: Record<string, unknown> }).failures
  if (!failures) return false
  return Object.values(failures).some((failure) => isConstraintError(failure))
}

const findDuplicateId = async <T extends { id: EntityId }>(
  table: Table<T, EntityId, T>,
  items: T[],
): Promise<EntityId | undefined> => {
  const seen = new Set<EntityId>()
  for (const item of items) {
    if (seen.has(item.id)) return item.id
    seen.add(item.id)
  }
  const existing = await table.bulkGet(items.map((item) => item.id))
  return existing.find((row): row is T => row !== undefined)?.id
}

const matchesFilters = <T>(
  item: T,
  dateField: keyof T & string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): boolean => {
  if (dateFrom !== undefined && String(item[dateField]) < dateFrom) return false
  if (dateTo !== undefined && String(item[dateField]) > dateTo) return false
  return true
}

const buildCursorItem = <T extends { id: EntityId }>(
  payload: CursorPayload,
  sortBy: keyof T,
  tiebreakField: (keyof T & string) | undefined,
): T => {
  return {
    [sortBy]: payload.sortValue,
    ...(tiebreakField ? { [tiebreakField]: payload.tiebreakValue } : {}),
    id: payload.id,
  } as T
}

const createCrudRepo = <T extends { id: EntityId }>(
  config: EntityConfig<T>,
  ensureReady: () => Promise<void>,
  database: ProfileDb,
): CrudRepo<T> => {
  const { table, dateField, tiebreakField, fastIndex, validate, entityLabel } = config

  const fetchCandidates = async (
    dateFrom: string | undefined,
    dateTo: string | undefined,
  ): Promise<T[]> => {
    const hasDateRange = dateFrom !== undefined || dateTo !== undefined

    if (hasDateRange) {
      return table
        .where(dateField)
        .between(dateFrom ?? '', dateTo ?? '￿', true, true)
        .toArray()
    }
    return table.toArray()
  }

  const listSlow = async (
    dateFrom: string | undefined,
    dateTo: string | undefined,
    sortBy: keyof T,
    sortDir: 'asc' | 'desc',
    limit: number | undefined,
    cursor: string | undefined,
  ): Promise<ListResult<T>> => {
    const candidates = await fetchCandidates(dateFrom, dateTo)
    const filtered = candidates.filter((item) => matchesFilters(item, dateField, dateFrom, dateTo))

    const comparator = makeComparator<T>(sortBy, sortDir, tiebreakField)
    const sorted = filtered.toSorted(comparator)

    let afterCursor = sorted
    if (cursor !== undefined) {
      const decoded = decodeCursor(cursor, String(sortBy), sortDir)
      const cursorItem = buildCursorItem<T>(decoded, sortBy, tiebreakField)
      afterCursor = sorted.filter((item) => comparator(item, cursorItem) > 0)
    }

    const page = limit !== undefined ? afterCursor.slice(0, limit) : afterCursor
    const hasMore = limit !== undefined && afterCursor.length > page.length
    const lastItem = page.at(-1)

    return {
      items: page,
      ...(hasMore && lastItem
        ? { nextCursor: encodeCursor(lastItem, sortBy, sortDir, tiebreakField) }
        : {}),
    }
  }

  const tryFastPath = async (
    dateFrom: string | undefined,
    dateTo: string | undefined,
    sortDir: 'asc' | 'desc',
    limit: number,
    cursor: string | undefined,
  ): Promise<ListResult<T> | null> => {
    let dateLower = dateFrom ?? ''
    let dateUpper = dateTo ?? '￿'
    let tieLower = ''
    let tieUpper = '￿'

    let cursorItem: T | undefined
    if (cursor !== undefined) {
      const payload = decodeCursor(cursor, String(dateField), sortDir)
      cursorItem = buildCursorItem<T>(payload, dateField, tiebreakField)
      const tieValue = String(tiebreakField ? payload.tiebreakValue : payload.id)
      if (sortDir === 'desc') {
        dateUpper = String(payload.sortValue)
        tieUpper = tieValue
      } else {
        dateLower = String(payload.sortValue)
        tieLower = tieValue
      }
    }

    const lower = [dateLower, tieLower]
    const upper = [dateUpper, tieUpper]

    const fetchSize = limit + 1 + TIE_SAFETY_MARGIN
    let collection = table.where(fastIndex).between(lower, upper, true, true)
    // Dexie's Collection#reverse() flips index iteration direction, not Array#reverse().
    // oxlint-disable-next-line unicorn/no-array-reverse
    if (sortDir === 'desc') collection = collection.reverse()
    const window = await collection.limit(fetchSize).toArray()

    const comparator = makeComparator<T>(dateField, sortDir, tiebreakField)
    const usable = cursorItem
      ? window.filter((item) => comparator(item, cursorItem as T) > 0)
      : window

    if (usable.length < limit + 1 && window.length === fetchSize) {
      return null
    }

    const filtered = usable.filter((item) => matchesFilters(item, dateField, dateFrom, dateTo))
    const page = filtered.slice(0, limit)
    const hasMore = filtered.length > page.length
    const lastItem = page.at(-1)

    return {
      items: page,
      ...(hasMore && lastItem
        ? { nextCursor: encodeCursor(lastItem, dateField, sortDir, tiebreakField) }
        : {}),
    }
  }

  const list = async (query: ListQuery<T> = {}): Promise<ListResult<T>> => {
    await ensureReady()
    try {
      const { dateFrom, dateTo, sortDir = 'desc', limit, cursor } = query
      validateLimit(limit)
      const sortBy = query.sortBy ?? dateField

      if (sortBy === dateField && limit !== undefined) {
        const fast = await tryFastPath(dateFrom, dateTo, sortDir, limit, cursor)
        if (fast) return fast
      }

      return await listSlow(dateFrom, dateTo, sortBy, sortDir, limit, cursor)
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  const get = async (id: EntityId): Promise<T | undefined> => {
    await ensureReady()
    try {
      return await table.get(id)
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  const add = async (item: T): Promise<T> => {
    await ensureReady()
    validate(item)
    try {
      const fresh = { ...item }
      await table.add(fresh)
      return fresh
    } catch (error) {
      if (isConstraintError(error)) {
        throw new RepoError(`id "${item.id}" already exists`, 'invalid_input', { cause: error })
      }
      return wrapUnknown(error)
    }
  }

  const addMany = async (items: T[]): Promise<T[]> => {
    await ensureReady()
    items.forEach((item) => validate(item))
    try {
      const fresh = items.map((item) => ({ ...item }))
      await database.transaction('rw', table, async () => {
        await table.bulkAdd(fresh)
      })
      return fresh
    } catch (error) {
      if (hasConstraintFailure(error)) {
        try {
          const duplicateId = await findDuplicateId(table, items)
          throw new RepoError(
            duplicateId
              ? `id "${duplicateId}" already exists`
              : 'one or more ids in this batch already exist',
            'invalid_input',
            { cause: error },
          )
        } catch (lookupError) {
          wrapUnknown(lookupError)
        }
      }
      return wrapUnknown(error)
    }
  }

  const update = async (id: EntityId, patch: Partial<Omit<T, 'id'>>): Promise<T> => {
    await ensureReady()
    try {
      return await database.transaction('rw', table, async () => {
        const existing = await table.get(id)
        if (!existing) {
          throw new RepoError(`no ${entityLabel} with id "${id}"`, 'not_found')
        }
        const merged = { ...existing, ...patch, id } as T
        validate(merged)
        await table.put(merged)
        return merged
      })
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  const remove = async (id: EntityId): Promise<void> => {
    await ensureReady()
    try {
      await database.transaction('rw', table, async () => {
        const existing = await table.get(id)
        if (!existing) {
          throw new RepoError(`no ${entityLabel} with id "${id}"`, 'not_found')
        }
        await table.delete(id)
      })
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  const removeMany = async (ids: EntityId[]): Promise<void> => {
    await ensureReady()
    try {
      await database.transaction('rw', table, async () => {
        for (const id of ids) {
          const existing = await table.get(id)
          if (!existing) {
            throw new RepoError(`no ${entityLabel} with id "${id}"`, 'not_found')
          }
        }
        await table.bulkDelete(ids)
      })
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  return { list, get, add, addMany, update, remove, removeMany }
}

const performReady = async (database: ProfileDb): Promise<void> => {
  const stored = await database.config.get(CONFIG_ID)

  if (!stored) {
    const seeded: ConfigRow = { ...buildSeedConfig(), id: CONFIG_ID }
    await database.config.put(seeded)
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
  await database.config.update(CONFIG_ID, { schemaVersion: SCHEMA_VERSION })
}

const readyPromises = new WeakMap<ProfileDb, Promise<void>>()

const makeReady = (database: ProfileDb): (() => Promise<void>) => {
  return (): Promise<void> => {
    let promise = readyPromises.get(database)
    if (!promise) {
      promise = performReady(database).catch((error: unknown) => {
        readyPromises.delete(database)
        throw error instanceof RepoError
          ? error
          : new RepoError(error instanceof Error ? error.message : String(error), 'unknown', {
              cause: error,
            })
      })
      readyPromises.set(database, promise)
    }
    return promise
  }
}

export const __resetReadyMemoForTests = (database: ProfileDb = db): void => {
  readyPromises.delete(database)
}

export const createLocalRepo = (database: ProfileDb = db): Repo => {
  const ready = makeReady(database)

  const movimientos = createCrudRepo<Movimiento>(
    {
      table: database.movimientos as Table<Movimiento, EntityId, Movimiento>,
      dateField: 'fecha',
      tiebreakField: 'createdAt',
      fastIndex: '[fecha+createdAt]',
      validate: validateMovimiento,
      entityLabel: 'movimiento',
    },
    ready,
    database,
  )

  const activos = createCrudRepo<Activo>(
    {
      table: database.activos as Table<Activo, EntityId, Activo>,
      dateField: 'fechaActualizacion',
      tiebreakField: undefined,
      fastIndex: '[fechaActualizacion+id]',
      validate: validateActivo,
      entityLabel: 'activo',
    },
    ready,
    database,
  )

  const getConfig = async (): Promise<Config> => {
    await ready()
    try {
      const row = await database.config.get(CONFIG_ID)
      if (!row) {
        throw new RepoError('config missing after ready()', 'unknown')
      }
      const { id: _id, ...config } = row
      return config
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  const updateConfig = async (patch: Partial<Config>): Promise<Config> => {
    await ready()
    if (patch.schemaVersion !== undefined) {
      throw new RepoError('schemaVersion is not caller-writable via updateConfig', 'invalid_input')
    }
    try {
      const merged = await database.transaction('rw', database.config, async () => {
        const existing = await database.config.get(CONFIG_ID)
        if (!existing) {
          throw new RepoError('config missing after ready()', 'unknown')
        }
        const next: ConfigRow = { ...existing, ...patch, id: CONFIG_ID }
        await database.config.put(next)
        return next
      })
      const { id: _mergedId, ...config } = merged
      return config
    } catch (error) {
      return wrapUnknown(error)
    }
  }

  return { ready, movimientos, activos, getConfig, updateConfig }
}
