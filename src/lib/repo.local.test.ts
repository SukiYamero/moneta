import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { RepoError } from '@/lib/repo'
import { createLocalRepo, migrateSchema, type Migration } from '@/lib/repo.local'
import {
  CONFIG_SEMILLA,
  SCHEMA_VERSION,
  type Activo,
  type Config,
  type Moneda,
  type Movimiento,
} from '@/lib/schema'

afterEach(async () => {
  await db.movimientos.clear()
  await db.activos.clear()
  await db.config.clear()
})

function movimiento(overrides: Partial<Movimiento> = {}): Movimiento {
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

function activo(overrides: Partial<Activo> = {}): Activo {
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
})

describe('movimientos CRUD', () => {
  it('adds and gets a movimiento', async () => {
    const repo = createLocalRepo()
    const m = movimiento()
    const added = await repo.movimientos.add(m)
    expect(added).toEqual(m)
    const fetched = await repo.movimientos.get(m.id)
    expect(fetched).toEqual(m)
  })

  it('get() on a missing id returns undefined, not a throw', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.get('missing')).resolves.toBeUndefined()
  })

  it('updates an existing movimiento with a shallow patch', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento())
    const updated = await repo.movimientos.update(m.id, { monto: 2000, nota: 'ajustado' })
    expect(updated.monto).toBe(2000)
    expect(updated.nota).toBe('ajustado')
    expect(updated.id).toBe(m.id)
  })

  it('update() on a missing id throws RepoError(not_found)', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.update('missing', { monto: 1 })).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('removes an existing movimiento', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento())
    await repo.movimientos.remove(m.id)
    await expect(repo.movimientos.get(m.id)).resolves.toBeUndefined()
  })

  it('remove() on a missing id throws RepoError(not_found)', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.remove('missing')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('does not mutate the caller-supplied object on add()', async () => {
    const repo = createLocalRepo()
    const m = movimiento()
    const frozen = { ...m }
    await repo.movimientos.add(m)
    expect(m).toEqual(frozen)
  })

  it('returns fresh objects: mutating a read result never affects stored data', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento())
    const read = await repo.movimientos.get(m.id)
    // biome/ts: intentional in-place mutation of the *returned* object only
    ;(read as Movimiento).monto = 999_999
    const readAgain = await repo.movimientos.get(m.id)
    expect(readAgain?.monto).toBe(m.monto)
  })
})

describe('movimientos bulk paths (addMany / removeMany)', () => {
  it('addMany adds every item in one transaction', async () => {
    const repo = createLocalRepo()
    const items = [movimiento(), movimiento(), movimiento()]
    const added = await repo.movimientos.addMany(items)
    expect(added).toHaveLength(3)
    const { items: stored } = await repo.movimientos.list()
    expect(stored).toHaveLength(3)
  })

  it('addMany is all-or-nothing: one bad row rolls back the whole batch', async () => {
    const repo = createLocalRepo()
    const dup = movimiento()
    await repo.movimientos.add(dup)
    const batch = [movimiento(), { ...dup }, movimiento()] // dup.id already exists -> ConstraintError
    await expect(repo.movimientos.addMany(batch)).rejects.toBeInstanceOf(RepoError)
    const { items } = await repo.movimientos.list()
    expect(items).toHaveLength(1) // only the original `dup`, batch fully rolled back
  })

  it('removeMany removes every id in one transaction', async () => {
    const repo = createLocalRepo()
    const a = await repo.movimientos.add(movimiento())
    const b = await repo.movimientos.add(movimiento())
    await repo.movimientos.removeMany([a.id, b.id])
    const { items } = await repo.movimientos.list()
    expect(items).toHaveLength(0)
  })

  it('removeMany is all-or-nothing: one missing id rolls back the whole batch', async () => {
    const repo = createLocalRepo()
    const a = await repo.movimientos.add(movimiento())
    await expect(repo.movimientos.removeMany([a.id, 'missing'])).rejects.toMatchObject({
      code: 'not_found',
    })
    const { items } = await repo.movimientos.list()
    expect(items).toHaveLength(1) // `a` was NOT removed despite being valid
  })
})

describe('movimientos validation (money)', () => {
  it('rejects monto <= 0', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.add(movimiento({ monto: 0 }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
    await expect(repo.movimientos.add(movimiento({ monto: -5 }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('rejects a non-finite monto', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.add(movimiento({ monto: Number.NaN }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
    await expect(
      repo.movimientos.add(movimiento({ monto: Number.POSITIVE_INFINITY })),
    ).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('rejects a non-ISO fecha', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.add(movimiento({ fecha: '01/01/2026' }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
    await expect(repo.movimientos.add(movimiento({ fecha: '2026-13-40' }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('rejects a missing moneda', async () => {
    const repo = createLocalRepo()
    const bad = { ...movimiento(), moneda: '' as unknown as Moneda }
    await expect(repo.movimientos.add(bad)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('validates on update() too, not just add()', async () => {
    const repo = createLocalRepo()
    const m = await repo.movimientos.add(movimiento())
    await expect(repo.movimientos.update(m.id, { monto: -1 })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('never silently coerces invalid input: the row is not written', async () => {
    const repo = createLocalRepo()
    const bad = movimiento({ monto: -1 })
    await expect(repo.movimientos.add(bad)).rejects.toThrow()
    await expect(repo.movimientos.get(bad.id)).resolves.toBeUndefined()
  })
})

describe('activos validation (money)', () => {
  it('rejects a non-ISO fechaActualizacion', async () => {
    const repo = createLocalRepo()
    await expect(
      repo.activos.add(activo({ fechaActualizacion: 'not-a-date' })),
    ).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('rejects a missing moneda', async () => {
    const repo = createLocalRepo()
    const bad = { ...activo(), moneda: '' as unknown as Moneda }
    await expect(repo.activos.add(bad)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('rejects a negative or non-finite valorActual', async () => {
    const repo = createLocalRepo()
    await expect(repo.activos.add(activo({ valorActual: -1 }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
    await expect(repo.activos.add(activo({ valorActual: Number.NaN }))).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('accepts a valid activo', async () => {
    const repo = createLocalRepo()
    const a = activo()
    await expect(repo.activos.add(a)).resolves.toEqual(a)
  })
})

describe('list() — filtering', () => {
  it('empty store returns { items: [] }, never an error', async () => {
    const repo = createLocalRepo()
    await expect(repo.movimientos.list()).resolves.toEqual({ items: [] })
  })

  it('dateFrom/dateTo are inclusive on fecha', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ fecha: '2026-01-01' }),
      movimiento({ fecha: '2026-01-05' }),
      movimiento({ fecha: '2026-01-10' }),
    ])
    const { items } = await repo.movimientos.list({ dateFrom: '2026-01-01', dateTo: '2026-01-05' })
    expect(items.map((m) => m.fecha).toSorted()).toEqual(['2026-01-01', '2026-01-05'])
  })

  it('seccion filters by exact match', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ seccion: 'sec_personal' }),
      movimiento({ seccion: 'sec_trabajo' }),
    ])
    const { items } = await repo.movimientos.list({ seccion: 'sec_trabajo' })
    expect(items).toHaveLength(1)
    expect(items[0]?.seccion).toBe('sec_trabajo')
  })

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

describe('list() — sorting', () => {
  it('defaults to fecha desc', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ fecha: '2026-01-01' }),
      movimiento({ fecha: '2026-01-03' }),
      movimiento({ fecha: '2026-01-02' }),
    ])
    const { items } = await repo.movimientos.list()
    expect(items.map((m) => m.fecha)).toEqual(['2026-01-03', '2026-01-02', '2026-01-01'])
  })

  it('breaks ties on the same fecha by createdAt, following sortDir uniformly', async () => {
    const repo = createLocalRepo()
    const older = movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T08:00:00.000Z' })
    const newer = movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T09:00:00.000Z' })
    await repo.movimientos.addMany([newer, older])
    // sortDir applies to the whole key tuple, not just fecha: desc means the
    // tiebreak is desc too, so the more-recently-created row sorts first —
    // this is what lets the fast path express the order as one lexicographic
    // range scan over `[fecha+createdAt]` with `.reverse()`.
    const desc = await repo.movimientos.list()
    expect(desc.items.map((m) => m.id)).toEqual([newer.id, older.id])
    const asc = await repo.movimientos.list({ sortDir: 'asc' })
    expect(asc.items.map((m) => m.id)).toEqual([older.id, newer.id])
  })

  it('breaks a full tie (same fecha AND createdAt) deterministically by id, following sortDir', async () => {
    const repo = createLocalRepo()
    const a = movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T08:00:00.000Z', id: 'aaa' })
    const b = movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T08:00:00.000Z', id: 'bbb' })
    await repo.movimientos.addMany([b, a])
    const first = await repo.movimientos.list() // desc: id desc too -> 'bbb' first
    const second = await repo.movimientos.list()
    expect(first.items.map((m) => m.id)).toEqual(['bbb', 'aaa'])
    expect(second.items.map((m) => m.id)).toEqual(first.items.map((m) => m.id))
  })

  it('honors an explicit sortBy/sortDir', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.addMany([
      movimiento({ monto: 300 }),
      movimiento({ monto: 100 }),
      movimiento({ monto: 200 }),
    ])
    const { items } = await repo.movimientos.list({ sortBy: 'monto', sortDir: 'asc' })
    expect(items.map((m) => m.monto)).toEqual([100, 200, 300])
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

  it('rejects a malformed cursor as invalid_input rather than crashing', async () => {
    const repo = createLocalRepo()
    await repo.movimientos.add(movimiento())
    await expect(repo.movimientos.list({ cursor: 'not-a-real-cursor' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })
})

describe('Config', () => {
  it('shallow-merges a patch: untouched top-level keys survive', async () => {
    const repo = createLocalRepo()
    await repo.ready()
    const before = await repo.getConfig()
    const updated = await repo.updateConfig({ secciones: [] })
    expect(updated.secciones).toEqual([])
    expect(updated.categorias).toEqual(before.categorias)
    expect(updated.preferencias).toEqual(before.preferencias)
  })

  it('is atomic: getConfig() after updateConfig() reflects the full merged result', async () => {
    const repo = createLocalRepo()
    await repo.updateConfig({ secciones: [] })
    const config = await repo.getConfig()
    expect(config.secciones).toEqual([])
  })

  it('rejects a caller-supplied schemaVersion; the stored version is unchanged', async () => {
    const repo = createLocalRepo()
    await repo.ready()
    await expect(repo.updateConfig({ schemaVersion: 999 })).rejects.toMatchObject({
      code: 'invalid_input',
    })
    const config = await repo.getConfig()
    expect(config.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('returns fresh objects: mutating a getConfig() result never affects stored data', async () => {
    const repo = createLocalRepo()
    const config = await repo.getConfig()
    ;(config as Config).secciones.push({ id: 'hack', nombre: 'x', orden: 99 })
    const again = await repo.getConfig()
    expect(again.secciones).toEqual(CONFIG_SEMILLA.secciones)
  })
})

describe('list() — fast path is a bounded read, not a full scan', () => {
  async function seedManyMovimientos(count: number, distinctDates: number): Promise<Movimiento[]> {
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
  async function walkAllPages(
    repo: ReturnType<typeof createLocalRepo>,
    limit: number,
  ): Promise<string[]> {
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

  it('walks a tie cluster smaller than TIE_SAFETY_MARGIN with no skips or duplicates', async () => {
    const repo = createLocalRepo()
    const tied = Array.from({ length: 10 }, () =>
      movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' }),
    )
    await repo.movimientos.addMany(tied)

    const seen = await walkAllPages(repo, 3)
    expect(seen).toHaveLength(10)
    expect(new Set(seen).size).toBe(10)
    expect(new Set(seen)).toEqual(new Set(tied.map((m) => m.id)))
  })

  it('walks a tie cluster larger than TIE_SAFETY_MARGIN correctly via the slow-path bail-out', async () => {
    const repo = createLocalRepo()
    // TIE_SAFETY_MARGIN is 32; a 50-row exact tie forces `tryFastPath` to
    // bail (it can't prove it's seen everything within its bounded window),
    // exercising the fallback to `listSlow` rather than just the common case.
    const tied = Array.from({ length: 50 }, () =>
      movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' }),
    )
    await repo.movimientos.addMany(tied)

    const seen = await walkAllPages(repo, 3)
    expect(seen).toHaveLength(50)
    expect(new Set(seen).size).toBe(50)
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
