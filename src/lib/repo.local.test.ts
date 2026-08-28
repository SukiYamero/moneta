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
  __resetReadyMemoForTests()
})

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => {
  return {
    id: crypto.randomUUID(),
    fecha: '2026-01-01',
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
    await db.config.put({ ...CONFIG_SEMILLA, categorias: [], id: 1 })
    const repo = createLocalRepo()
    await repo.ready()
    const config = await repo.getConfig()
    expect(config.categorias).toEqual([])
  })

  it('rejects with schema_mismatch when stored data is newer than this build', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, schemaVersion: SCHEMA_VERSION + 1, id: 1 })
    const repo = createLocalRepo()
    await expect(repo.ready()).rejects.toMatchObject({ code: 'schema_mismatch' })
  })

  it('rejects with schema_mismatch when stored data is at schemaVersion 1 and no migration is registered — the deliberate no-migration decision for this contract change', async () => {
    await db.config.put({ ...CONFIG_SEMILLA, schemaVersion: 1, id: 1 })
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
    const repoA = createLocalRepo()
    const repoB = createLocalRepo()
    const putSpy = vi.spyOn(db.config, 'put')
    await Promise.all([repoA.ready(), repoB.ready()])
    expect(putSpy).toHaveBeenCalledTimes(1)
    putSpy.mockRestore()
  })

  it('ready() runs performReady() exactly once per database connection, not once per call', async () => {
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
    await db.config.put({ ...CONFIG_SEMILLA, id: 1 })
    await expect(repo.ready()).resolves.toBeUndefined()
  })
})

describe('movimientos CRUD', () => {
  it('update() not_found error names the entity, not the date field it happens to sort by', async () => {
    const repo = createLocalRepo()
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
    await expect(repo.movimientos.add({ ...m })).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(repo.movimientos.add({ ...m })).rejects.toThrow(new RegExp(m.id))
  })
})

describe('movimientos CRUD — update()/remove() atomicity', () => {
  it('update() is atomic: two concurrent patches on the same id never lose a write', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento({ monto: 100, categoria: 'cat_sueldo' }))
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
  it('applies dateFrom/dateTo to activos, keyed off fechaActualizacion', async () => {
    const repo = createLocalRepo()
    await repo.activos.addMany([
      activo({ fechaActualizacion: '2026-01-01' }),
      activo({ fechaActualizacion: '2026-06-01' }),
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

    const inserted = await repo.movimientos.add(
      movimiento({ fecha: '2026-01-03', createdAt: '2020-01-01T00:00:00.000Z' }),
    )

    const page2 = await repo.movimientos.list({ limit: 2, cursor: page1.nextCursor })
    expect(page2.items.map((m) => m.id)).toContain(inserted.id)
    expect(page2.items.map((m) => m.fecha)).toEqual(['2026-01-03', '2026-01-02'])

    const page3 = await repo.movimientos.list({ limit: 2, cursor: page2.nextCursor })
    const allIds = [...page1.items, ...page2.items, ...page3.items].map((m) => m.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('an insert sorting before the cursor is not retroactively injected into the next page', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ fecha: '2026-01-04' }),
      movimiento({ fecha: '2026-01-03' }),
      movimiento({ fecha: '2026-01-02' }),
    ])

    const page1 = await repo.movimientos.list({ limit: 2 })
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
    await repo.updateConfig({ categorias: [] })
    const config = await repo.getConfig()
    expect(config.categorias).toEqual([])
  })
})

describe('Config — error normalization', () => {
  it.each([
    [
      'getConfig() wraps an unexpected db.config.get() failure',
      'get',
      (repo: ReturnType<typeof createLocalRepo>) => repo.getConfig(),
    ],
    [
      'updateConfig() wraps an unexpected db.config.get() failure',
      'get',
      (repo: ReturnType<typeof createLocalRepo>) => repo.updateConfig({ categorias: [] }),
    ],
    [
      'updateConfig() wraps an unexpected db.config.put() failure',
      'put',
      (repo: ReturnType<typeof createLocalRepo>) => repo.updateConfig({ categorias: [] }),
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

    const tableToArraySpy = vi.spyOn(db.movimientos, 'toArray')
    const collectionToArraySpy = vi.spyOn(db.Collection.prototype, 'toArray')

    const page = await repo.movimientos.list({ limit: 20 })

    expect(page.items).toHaveLength(20)
    expect(page.nextCursor).toBeDefined()
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
      await otherRepo.updateConfig({ categorias: [] })

      const otherConfig = await otherRepo.getConfig()
      expect(otherConfig.categorias).toEqual([])

      const defaultRepo = createLocalRepo()
      const defaultConfig = await defaultRepo.getConfig()
      expect(defaultConfig.categorias.length).toBeGreaterThan(0)
    } finally {
      otherDb.close()
      await otherDb.delete()
    }
  })
})
