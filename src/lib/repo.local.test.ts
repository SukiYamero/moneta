import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProfileDb, db } from '@/lib/db'
import { RepoError } from '@/lib/repo'
import { testRepoContract } from '@/lib/repo.contract'
import {
  __resetReadyMemoForTests,
  createLocalRepo,
  migrateSchema,
  type Migration,
} from '@/lib/repo.local'
import { CONFIG_SEMILLA, SCHEMA_VERSION, type Activo, type Movimiento } from '@/lib/schema'

afterEach(async () => {
  await db.movimientos.clear()
  await db.activos.clear()
  await db.config.clear()
  // `ready()`'s memo now runs once per database connection (not once per
  // call) — `db` is a singleton reused across this whole file, so without
  // this reset a resolved memo from an earlier test would leak into the
  // next one and skip performReady() against config just cleared above.
  __resetReadyMemoForTests()
})

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => {
  return {
    id: crypto.randomUUID(),
    fecha: '2026-01-01',
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 1000,
    moneda: 'COP',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const activo = (overrides: Partial<Activo> = {}): Activo => {
  return {
    id: crypto.randomUUID(),
    nombre: 'CDT Bancolombia',
    tipo: 'CDT',
    valorActual: 1000,
    moneda: 'COP',
    fechaActualizacion: '2026-01-01',
    ...overrides,
  }
}

// Behavior every Repo implementation must agree on — run here and in
// repo.fake.test.ts against the same suite. Anything
// below this point in the file is implementation-specific to the dexie-
// backed repo (fast path, ready()/migration mechanics, cursor identity
// binding, message-text regressions, concurrency mechanics).
testRepoContract(() => createLocalRepo())

describe('migrateSchema (dispatch registry)', () => {
  it('runs every migration from fromVersion+1 through toVersion, in order', async () => {
    const calls: number[] = []
    const registry: Record<number, Migration> = {
      2: async () => {
        calls.push(2)
      },
      3: async () => {
        calls.push(3)
      },
    }
    await migrateSchema(1, 3, registry)
    expect(calls).toEqual([2, 3])
  })

  it('is a no-op when fromVersion already equals toVersion', async () => {
    const registry: Record<number, Migration> = {}
    await expect(migrateSchema(1, 1, registry)).resolves.toBeUndefined()
  })

  it('throws schema_mismatch when a migration is missing in the range', async () => {
    const registry: Record<number, Migration> = { 2: async () => {} }
    // needs 2 and 3, only 2 is registered
    await expect(migrateSchema(1, 3, registry)).rejects.toMatchObject({
      code: 'schema_mismatch',
    })
  })
})

describe('ready() / schemaVersion gate', () => {
  it('seeds CONFIG_SEMILLA on a fresh store', async () => {
    const repo = createLocalRepo()
    await repo.ready()
    const config = await repo.getConfig()
    expect(config).toEqual(CONFIG_SEMILLA)
  })

  it('derives monedaPrincipal from the device region on a fresh store', async () => {
    vi.stubGlobal('navigator', { ...navigator, languages: ['es-MX'] })
    const repo = createLocalRepo()
    await repo.ready()
    const config = await repo.getConfig()
    expect(config.preferencias.monedaPrincipal).toBe('MXN')
    vi.unstubAllGlobals()
  })

  // A stored Config always wins — this is a first-run default, never a
  // reassignment of a currency the user already has.
  it('never re-derives monedaPrincipal for an already-seeded store, even if the device region changes', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, id: 1 })
    vi.stubGlobal('navigator', { ...navigator, languages: ['es-MX'] })
    const repo = createLocalRepo()
    await repo.ready()
    const config = await repo.getConfig()
    expect(config.preferencias.monedaPrincipal).toBe('COP')
    vi.unstubAllGlobals()
  })

  it('leaves an already-current config untouched', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, secciones: [], id: 1 })
    const repo = createLocalRepo()
    await repo.ready()
    const config = await repo.getConfig()
    expect(config.secciones).toEqual([])
  })

  it('rejects with schema_mismatch when stored data is newer than this build', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, schemaVersion: SCHEMA_VERSION + 1, id: 1 })
    const repo = createLocalRepo()
    await expect(repo.ready()).rejects.toMatchObject({ code: 'schema_mismatch' })
  })

  it('propagates schema_mismatch to every other method, since they all await ready() first', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, schemaVersion: SCHEMA_VERSION + 1, id: 1 })
    const repo = createLocalRepo()
    await expect(repo.movimientos.list()).rejects.toMatchObject({ code: 'schema_mismatch' })
    await expect(repo.getConfig()).rejects.toMatchObject({ code: 'schema_mismatch' })
  })

  it('memoizes the in-flight ready() promise so concurrent callers only seed once', async () => {
    const repo = createLocalRepo()
    const putSpy = vi.spyOn(db.config, 'put')
    await Promise.all([repo.ready(), repo.ready(), repo.ready()])
    expect(putSpy).toHaveBeenCalledTimes(1)
    putSpy.mockRestore()
  })

  it('memoizes the in-flight ready() across different repo instances backed by the same database', async () => {
    // Two separate createLocalRepo() calls share the same underlying `db`
    // singleton — the memo must dedupe across them too, not just within one
    // instance, or two concurrent instances could double-run a migration.
    const repoA = createLocalRepo()
    const repoB = createLocalRepo()
    const putSpy = vi.spyOn(db.config, 'put')
    await Promise.all([repoA.ready(), repoB.ready()])
    expect(putSpy).toHaveBeenCalledTimes(1)
    putSpy.mockRestore()
  })

  it('ready() runs performReady() exactly once per database connection, not once per call', async () => {
    // Regression pin for the run-once guarantee: performReady() must not
    // re-run on every subsequent repo operation just because the in-flight
    // memo was cleared once the first call settled successfully.
    const repo = createLocalRepo()
    const getSpy = vi.spyOn(db.config, 'get')
    await repo.ready()
    expect(getSpy).toHaveBeenCalledTimes(1)
    await repo.movimientos.list()
    await repo.movimientos.get('missing')
    await repo.movimientos.add(movimiento())
    expect(getSpy).toHaveBeenCalledTimes(1)
    getSpy.mockRestore()
  })

  it('a failed ready() attempt clears the memo so a later call retries against fresh state', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, schemaVersion: SCHEMA_VERSION + 1, id: 1 })
    const repo = createLocalRepo()
    await expect(repo.ready()).rejects.toMatchObject({ code: 'schema_mismatch' })
    // Fix the stored data out-of-band, as a migration landing later would.
    await db.config.put({ ...CONFIG_SEMILLA, id: 1 })
    await expect(repo.ready()).resolves.toBeUndefined()
  })
})

describe('movimientos CRUD', () => {
  it('update() not_found error names the entity, not the date field it happens to sort by', async () => {
    const repo = createLocalRepo()
    // The error must name the entity, not the internal field it sorts by.
    await expect(repo.movimientos.update('missing', { monto: 1 })).rejects.toThrow(
      /movimiento with id/i,
    )
    await expect(repo.activos.update('missing', { valorActual: 1 })).rejects.toThrow(
      /activo with id/i,
    )
  })

  it('removeMany() not_found error names the entity too, same as remove()/update()', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.removeMany(['missing'])).rejects.toThrow(/movimiento with id/i)
  })

  it('add() with a duplicate id rejects as invalid_input, naming the id, not unknown', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento())
    // A duplicate id is bad caller input (id must be unique), not a
    // storage-layer failure — Dexie's ConstraintError must not fall through
    // to the generic 'unknown' code.
    await expect(repo.movimientos.add({ ...m })).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(repo.movimientos.add({ ...m })).rejects.toThrow(new RegExp(m.id))
  })
})

describe('movimientos CRUD — update()/remove() atomicity', () => {
  it('update() is atomic: two concurrent patches on the same id never lose a write', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento({ monto: 100, categoria: 'cat_sueldo' }))
    // Both read-merge-write cycles must be serialized against each other, or
    // the second `put` silently clobbers the first's patch with no error.
    await Promise.all([
      repo.movimientos.update(m.id, { monto: 200 }),
      repo.movimientos.update(m.id, { categoria: 'cat_otro' }),
    ])
    const final = await repo.movimientos.get(m.id)
    expect(final?.monto).toBe(200)
    expect(final?.categoria).toBe('cat_otro')
  })

  it('remove() is atomic: concurrent calls on the same id resolve exactly one and reject the other with not_found', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento())
    const results = await Promise.allSettled([
      repo.movimientos.remove(m.id),
      repo.movimientos.remove(m.id),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'not_found' })
  })
})

describe('movimientos bulk paths (addMany / removeMany)', () => {
  it('addMany with a duplicate id names the offending id in the error message', async () => {
    const repo = createLocalRepo()
    const dup = await repo.movimientos.add(movimiento())
    await expect(repo.movimientos.addMany([movimiento(), { ...dup }])).rejects.toThrow(
      new RegExp(dup.id),
    )
  })

  it('addMany() wraps a failure in the post-conflict duplicate-id lookup (bulkGet) as RepoError too', async () => {
    // The ConstraintError handler in addMany()'s catch block awaits
    // findDuplicateId() (a second storage call, table.bulkGet) to name the
    // offending id. If THAT call itself rejects — a second, unrelated
    // storage failure racing the first — the raw rejection must not escape
    // addMany() unwrapped; same guarantee as the primary bulkAdd failure.
    const repo = createLocalRepo()
    const existing = await repo.movimientos.add(movimiento())
    const bulkGetSpy = vi.spyOn(db.movimientos, 'bulkGet').mockRejectedValueOnce(new Error('boom'))
    const error: unknown = await repo.movimientos
      .addMany([movimiento(), { ...existing }])
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RepoError)
    bulkGetSpy.mockRestore()
  })
})

describe('list() — filtering', () => {
  it('combines seccion + date range (exercises the compound index path)', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ seccion: 'sec_trabajo', fecha: '2026-01-01' }),
      movimiento({ seccion: 'sec_trabajo', fecha: '2026-06-01' }), // out of range
      movimiento({ seccion: 'sec_personal', fecha: '2026-01-15' }), // wrong section
    ])
    const { items } = await repo.movimientos.list({
      seccion: 'sec_trabajo',
      dateFrom: '2026-01-01',
      dateTo: '2026-02-01',
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.fecha).toBe('2026-01-01')
  })

  it('applies the same dateFrom/dateTo/seccion semantics to activos, keyed off fechaActualizacion', async () => {
    const repo = createLocalRepo()
    await repo.activos.addMany([
      activo({ fechaActualizacion: '2026-01-01', seccion: 'sec_personal' }),
      activo({ fechaActualizacion: '2026-06-01', seccion: 'sec_personal' }),
    ])
    const { items } = await repo.activos.list({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    expect(items).toHaveLength(1)
    expect(items[0]?.fechaActualizacion).toBe('2026-01-01')
  })
})

describe('list() — keyset pagination', () => {
  it('walks every row exactly once across pages, in stable order', async () => {
    const repo = createLocalRepo()
    const seeded = [
      movimiento({ fecha: '2026-01-05' }),
      movimiento({ fecha: '2026-01-04' }),
      movimiento({ fecha: '2026-01-03' }),
      movimiento({ fecha: '2026-01-02' }),
      movimiento({ fecha: '2026-01-01' }),
    ]
    await repo.movimientos.addMany(seeded)

    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 10; guard++) {
      const page = await repo.movimientos.list({ limit: 2, cursor })
      seen.push(...page.items.map((m) => m.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(seen).toEqual(seeded.toSorted((a, b) => (a.fecha < b.fecha ? 1 : -1)).map((m) => m.id))
    expect(new Set(seen).size).toBe(5)
  })

  it('nextCursor is only present when more rows actually exist', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([movimiento(), movimiento()])
    const exact = await repo.movimientos.list({ limit: 2 })
    expect(exact.nextCursor).toBeUndefined()
    const short = await repo.movimientos.list({ limit: 5 })
    expect(short.nextCursor).toBeUndefined()
  })

  it('an insert sorting after the cursor surfaces exactly once on the next page, without disturbing the already-fetched page', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ fecha: '2026-01-04' }),
      movimiento({ fecha: '2026-01-03' }),
      movimiento({ fecha: '2026-01-02' }),
      movimiento({ fecha: '2026-01-01' }),
    ])

    const page1 = await repo.movimientos.list({ limit: 2 })
    expect(page1.items.map((m) => m.fecha)).toEqual(['2026-01-04', '2026-01-03'])
    expect(page1.nextCursor).toBeDefined()

    // Inserted between page fetches, tied on fecha with the page1 cursor but
    // with an earlier createdAt — under desc (tiebreak desc too), an earlier
    // createdAt sorts strictly after the cursor, i.e. lands on the next page.
    const inserted = await repo.movimientos.add(
      movimiento({ fecha: '2026-01-03', createdAt: '2020-01-01T00:00:00.000Z' }),
    )

    const page2 = await repo.movimientos.list({ limit: 2, cursor: page1.nextCursor })
    expect(page2.items.map((m) => m.id)).toContain(inserted.id)
    expect(page2.items.map((m) => m.fecha)).toEqual(['2026-01-03', '2026-01-02'])

    const page3 = await repo.movimientos.list({ limit: 2, cursor: page2.nextCursor })
    const allIds = [...page1.items, ...page2.items, ...page3.items].map((m) => m.id)
    expect(new Set(allIds).size).toBe(allIds.length) // no duplicates anywhere
  })

  it('an insert sorting before the cursor is not retroactively injected into the next page', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ fecha: '2026-01-04' }),
      movimiento({ fecha: '2026-01-03' }),
      movimiento({ fecha: '2026-01-02' }),
    ])

    const page1 = await repo.movimientos.list({ limit: 2 }) // [04, 03]
    // Sorts before the cursor (newer than everything already fetched).
    await repo.movimientos.add(movimiento({ fecha: '2026-01-05' }))

    const page2 = await repo.movimientos.list({ limit: 2, cursor: page1.nextCursor })
    expect(page2.items.map((m) => m.fecha)).toEqual(['2026-01-02'])
  })

  it('rejects a cursor minted under a different sortBy/sortDir instead of silently returning nothing', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ monto: 100, fecha: '2026-01-01' }),
      movimiento({ monto: 200, fecha: '2026-01-02' }),
      movimiento({ monto: 300, fecha: '2026-01-03' }),
    ])
    const mintedUnderMontoAsc = await repo.movimientos.list({
      sortBy: 'monto',
      sortDir: 'asc',
      limit: 2,
    })
    expect(mintedUnderMontoAsc.nextCursor).toBeDefined()
    // Default sortBy/sortDir (fecha desc) differs from what minted the cursor.
    await expect(
      repo.movimientos.list({ limit: 2, cursor: mintedUnderMontoAsc.nextCursor }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('accepts a cursor replayed with the exact sortBy/sortDir it was minted under', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ monto: 100 }),
      movimiento({ monto: 200 }),
      movimiento({ monto: 300 }),
    ])
    const page1 = await repo.movimientos.list({ sortBy: 'monto', sortDir: 'asc', limit: 2 })
    const page2 = await repo.movimientos.list({
      sortBy: 'monto',
      sortDir: 'asc',
      limit: 2,
      cursor: page1.nextCursor,
    })
    expect(page2.items.map((m) => m.monto)).toEqual([300])
  })
})

describe('Config', () => {
  it('is atomic: getConfig() after updateConfig() reflects the full merged result', async () => {
    const repo = createLocalRepo()
    await repo.updateConfig({ secciones: [] })
    const config = await repo.getConfig()
    expect(config.secciones).toEqual([])
  })
})

describe('Config — error normalization', () => {
  // getConfig()/updateConfig() sit outside createCrudRepo's factory and must
  // funnel a raw storage failure through the same wrapUnknown() normalization
  // every CrudRepo method uses, or a caller's `instanceof RepoError` check
  // silently falls through to an unhandled bare Error.
  it.each([
    [
      'getConfig() wraps an unexpected db.config.get() failure',
      'get',
      (repo: ReturnType<typeof createLocalRepo>) => repo.getConfig(),
    ],
    [
      'updateConfig() wraps an unexpected db.config.get() failure',
      'get',
      (repo: ReturnType<typeof createLocalRepo>) => repo.updateConfig({ secciones: [] }),
    ],
    [
      'updateConfig() wraps an unexpected db.config.put() failure',
      'put',
      (repo: ReturnType<typeof createLocalRepo>) => repo.updateConfig({ secciones: [] }),
    ],
  ] as const)('%s as RepoError(unknown)', async (_label, method, run) => {
    const repo = createLocalRepo()
    await repo.ready()
    const spy = vi.spyOn(db.config, method).mockRejectedValueOnce(new Error('boom'))
    const error: unknown = await run(repo).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RepoError)
    expect(error).toMatchObject({ code: 'unknown' })
    spy.mockRestore()
  })

  it('updateConfig() still rejects a caller-supplied schemaVersion as invalid_input, not unknown', async () => {
    // Regression guard: the schemaVersion guard must stay outside the
    // wrapping try/catch's "everything unexpected is unknown" umbrella.
    const repo = createLocalRepo()
    await repo.ready()
    await expect(repo.updateConfig({ schemaVersion: 999 })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })
})

describe('list() — fast path is a bounded read, not a full scan', () => {
  const seedManyMovimientos = async (
    count: number,
    distinctDates: number,
  ): Promise<Movimiento[]> => {
    const rows: Movimiento[] = []
    for (let i = 0; i < count; i++) {
      const day = i % distinctDates
      const fecha = `2020-${String(1 + (day % 12)).padStart(2, '0')}-${String(1 + (day % 28)).padStart(2, '0')}`
      rows.push(
        movimiento({
          fecha,
          // Distinct createdAt per row (millisecond-unique), matching real
          // writes — keeps ties on the fast-path compound index rare, as documented.
          createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, 0, i)).toISOString(),
        }),
      )
    }
    const repo = createLocalRepo()
    for (let i = 0; i < rows.length; i += 500) {
      await repo.movimientos.addMany(rows.slice(i, i + 500))
    }
    return rows
  }

  it('reads on the order of `limit` rows from a table of a few thousand, not the whole table', async () => {
    const seeded = await seedManyMovimientos(3000, 200)
    const repo = createLocalRepo()

    // `Table.prototype.toArray()` is the unbounded, whole-store read the bug
    // report was about — the fast path must never call it directly.
    const tableToArraySpy = vi.spyOn(db.movimientos, 'toArray')
    // `Table.toArray()` itself delegates to `Collection.prototype.toArray()`
    // internally, so spying at this shared layer measures exactly how many
    // rows any underlying read actually materialized, regardless of which
    // call issued it.
    const collectionToArraySpy = vi.spyOn(db.Collection.prototype, 'toArray')

    const page = await repo.movimientos.list({ limit: 20 })

    expect(page.items).toHaveLength(20)
    expect(page.nextCursor).toBeDefined()
    // Sanity: it's really the top 20 by fecha desc, not an arbitrary slice.
    const expectedTopFecha = seeded.toSorted((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]?.fecha
    expect(page.items[0]?.fecha).toBe(expectedTopFecha)

    expect(tableToArraySpy).not.toHaveBeenCalled()

    const resolvedLengths = await Promise.all(
      collectionToArraySpy.mock.results.map(async (result) => {
        if (result.type !== 'return') return 0
        const value: unknown = await result.value
        return Array.isArray(value) ? value.length : 0
      }),
    )
    const maxMaterialized = resolvedLengths.length ? Math.max(...resolvedLengths) : 0

    // Bounded by limit + TIE_SAFETY_MARGIN (20 + 1 + 32 = 53), nowhere near
    // the 3000 seeded rows — this is the actual proof, not just "same page".
    expect(maxMaterialized).toBeGreaterThan(0)
    expect(maxMaterialized).toBeLessThan(100)

    tableToArraySpy.mockRestore()
    collectionToArraySpy.mockRestore()
  })

  it('keeps each page of a multi-page walk bounded, and still visits every row exactly once', async () => {
    const seeded = await seedManyMovimientos(2000, 150)
    const repo = createLocalRepo()

    const collectionToArraySpy = vi.spyOn(db.Collection.prototype, 'toArray')
    const perPageMax: number[] = []
    const seenIds = new Set<string>()
    let cursor: string | undefined
    for (let guard = 0; guard < 120; guard++) {
      collectionToArraySpy.mockClear()
      const page = await repo.movimientos.list({ limit: 25, cursor })
      const resolvedLengths = await Promise.all(
        collectionToArraySpy.mock.results.map(async (result) => {
          if (result.type !== 'return') return 0
          const value: unknown = await result.value
          return Array.isArray(value) ? value.length : 0
        }),
      )
      perPageMax.push(resolvedLengths.length ? Math.max(...resolvedLengths) : 0)
      for (const item of page.items) seenIds.add(item.id)
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }

    expect(seenIds.size).toBe(seeded.length)
    // No page's underlying read scaled anywhere near the 2000-row table.
    expect(Math.max(...perPageMax)).toBeLessThan(100)

    collectionToArraySpy.mockRestore()
  })
})

describe('list() — fast path correctness at the exact-tie boundary', () => {
  const walkAllPages = async (
    repo: ReturnType<typeof createLocalRepo>,
    limit: number,
  ): Promise<string[]> => {
    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 200; guard++) {
      const page = await repo.movimientos.list({ limit, cursor })
      seen.push(...page.items.map((m) => m.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    return seen
  }

  // TIE_SAFETY_MARGIN is 32: a tie cluster under it stays on the fast path;
  // over it forces `tryFastPath` to bail (it can't prove it's seen
  // everything within its bounded window) and fall back to `listSlow`.
  it.each([
    ['smaller than TIE_SAFETY_MARGIN (fast path)', 10],
    ['larger than TIE_SAFETY_MARGIN (listSlow fallback)', 50],
  ])('walks a tie cluster %s with no skips or duplicates', async (_label, count) => {
    const repo = createLocalRepo()
    const tied = Array.from({ length: count }, () =>
      movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' }),
    )
    await repo.movimientos.addMany(tied)

    const seen = await walkAllPages(repo, 3)
    expect(seen).toHaveLength(count)
    expect(new Set(seen).size).toBe(count)
    expect(new Set(seen)).toEqual(new Set(tied.map((m) => m.id)))
  })

  it('activos: the fast path (no separate tiebreak field, id-only) walks correctly too', async () => {
    const repo = createLocalRepo()
    const seeded = Array.from({ length: 120 }, (_, i) =>
      activo({ fechaActualizacion: `2026-01-${String(1 + (i % 20)).padStart(2, '0')}` }),
    )
    await repo.activos.addMany(seeded)

    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 20; guard++) {
      const page = await repo.activos.list({ limit: 10, cursor })
      seen.push(...page.items.map((a) => a.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(seen).toHaveLength(120)
    expect(new Set(seen).size).toBe(120)
  })
})

// createLocalRepo() must be able to open against any ProfileDb, not just the
// frozen module-level `db` — this is what lets a guest and a signed-in
// account read/write entirely separate stores on the same device.
describe('createLocalRepo(database) — per-profile isolation', () => {
  it('defaults to the frozen module-level db when no database is passed', async () => {
    const repo = createLocalRepo()
    const added = await repo.movimientos.add(movimiento())
    expect(await db.movimientos.get(added.id)).toBeDefined()
  })

  it("a repo built against a second database never sees the default db's data, and vice versa", async () => {
    const otherDb = createProfileDb('kurobello-profile-isolation-test')
    try {
      const defaultRepo = createLocalRepo()
      const otherRepo = createLocalRepo(otherDb)

      const inDefault = await defaultRepo.movimientos.add(movimiento())
      const inOther = await otherRepo.movimientos.add(movimiento())

      expect(await defaultRepo.movimientos.get(inOther.id)).toBeUndefined()
      expect(await otherRepo.movimientos.get(inDefault.id)).toBeUndefined()
      expect(await defaultRepo.movimientos.get(inDefault.id)).toBeDefined()
      expect(await otherRepo.movimientos.get(inOther.id)).toBeDefined()
    } finally {
      otherDb.close()
      await otherDb.delete()
    }
  })

  it('two repos built against the same non-default database share writes (same store, not two copies)', async () => {
    const otherDb = createProfileDb('kurobello-profile-shared-test')
    try {
      const repoA = createLocalRepo(otherDb)
      const repoB = createLocalRepo(otherDb)

      const added = await repoA.movimientos.add(movimiento())
      expect(await repoB.movimientos.get(added.id)).toEqual(added)
    } finally {
      otherDb.close()
      await otherDb.delete()
    }
  })

  it("ready()'s in-flight memo is keyed per database: two concurrent instances on different databases each run performReady()", async () => {
    const otherDb = createProfileDb('kurobello-profile-memo-test')
    try {
      const defaultRepo = createLocalRepo()
      const otherRepo = createLocalRepo(otherDb)

      const defaultPutSpy = vi.spyOn(db.config, 'put')
      const otherPutSpy = vi.spyOn(otherDb.config, 'put')

      await Promise.all([defaultRepo.ready(), otherRepo.ready()])

      expect(defaultPutSpy).toHaveBeenCalledTimes(1)
      expect(otherPutSpy).toHaveBeenCalledTimes(1)

      defaultPutSpy.mockRestore()
      otherPutSpy.mockRestore()
    } finally {
      otherDb.close()
      await otherDb.delete()
    }
  })

  it('getConfig()/updateConfig() operate on the passed database, not the default one', async () => {
    const otherDb = createProfileDb('kurobello-profile-config-test')
    try {
      const otherRepo = createLocalRepo(otherDb)
      await otherRepo.updateConfig({ secciones: [] })

      const otherConfig = await otherRepo.getConfig()
      expect(otherConfig.secciones).toEqual([])

      const defaultRepo = createLocalRepo()
      const defaultConfig = await defaultRepo.getConfig()
      expect(defaultConfig.secciones.length).toBeGreaterThan(0)
    } finally {
      otherDb.close()
      await otherDb.delete()
    }
  })
})
