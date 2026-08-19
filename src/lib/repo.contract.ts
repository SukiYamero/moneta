import { describe, expect, it } from 'vitest'
import type { Activo, Movimiento } from '@/lib/schema'
import type { Repo } from '@/lib/repo'

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
    seccion: 'sec_personal',
    valorActual: 1000,
    moneda: 'COP',
    fechaActualizacion: '2026-01-01',
    ...overrides,
  }
}

// Shared behavior every `Repo` implementation must agree on — imported and
// invoked from each implementation's own test file (repo.local.test.ts,
// repo.fake.test.ts), inside that file's own `describe`. A plain module, not
// a `*.test.ts` file: vitest would otherwise collect this as a standalone
// test file with no top-level test of its own (error, or a silent double
// run once the two callers also execute it).
//
// Scope: only behavior the `Repo`/`CrudRepo` port itself promises for every
// implementation. Anything an implementation may legitimately do
// differently — repo.local.ts's opaque cursor bound to the exact
// sortBy/sortDir it was minted under vs. repo.fake.ts's simpler
// index-encoded one (a deliberate divergence, specs.md §10.5/§11), or
// ready()/migration mechanics, which need implementation-specific backdoor
// setup to exercise — stays in that implementation's own test file, not
// here. Error assertions check `.code` only, never message text: wording is
// implementation-specific and not part of the contract (docs/error-handling.md §8).
//
// Precondition: `makeRepo()` must hand back a `Repo` whose `movimientos` and
// `activos` stores are empty — repo.fake.ts's `createFakeRepo()` seeds demo
// data by design, so its caller clears the seed first (see repo.fake.test.ts).
export function testRepoContract(makeRepo: () => Promise<Repo> | Repo): void {
  describe('Repo contract', () => {
    describe('get()', () => {
      it('returns undefined for a missing id, never throws', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.get('missing')).resolves.toBeUndefined()
      })

      it('returns a fresh object: mutating the result never affects stored data', async () => {
        const repo = await makeRepo()
        const m = await repo.movimientos.add(movimiento())
        const read = await repo.movimientos.get(m.id)
        ;(read as Movimiento).nota = 'tampered'
        const again = await repo.movimientos.get(m.id)
        expect(again?.nota).not.toBe('tampered')
      })
    })

    describe('add()', () => {
      it('adds and gets a movimiento back unchanged', async () => {
        const repo = await makeRepo()
        const m = movimiento()
        await repo.movimientos.add(m)
        await expect(repo.movimientos.get(m.id)).resolves.toEqual(m)
      })

      it('does not mutate the caller-supplied object', async () => {
        const repo = await makeRepo()
        const m = movimiento()
        const frozen = { ...m }
        await repo.movimientos.add(m)
        expect(m).toEqual(frozen)
      })

      it('rejects a duplicate id as invalid_input, not unknown', async () => {
        const repo = await makeRepo()
        const m = await repo.movimientos.add(movimiento())
        await expect(repo.movimientos.add({ ...m })).rejects.toMatchObject({
          code: 'invalid_input',
        })
      })
    })

    describe('update()', () => {
      it('merges a patch onto the existing row', async () => {
        const repo = await makeRepo()
        const m = await repo.movimientos.add(movimiento({ monto: 100 }))
        const updated = await repo.movimientos.update(m.id, { monto: 200 })
        expect(updated.monto).toBe(200)
        expect(updated.categoria).toBe(m.categoria)
      })

      it('re-pins id even if the patch tries to change it', async () => {
        const repo = await makeRepo()
        const m = await repo.movimientos.add(movimiento())
        const updated = await repo.movimientos.update(m.id, {
          ...({ id: 'hijacked' } as Partial<Movimiento>),
        })
        expect(updated.id).toBe(m.id)
      })

      it('rejects a missing id as not_found', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.update('missing', { monto: 1 })).rejects.toMatchObject({
          code: 'not_found',
        })
      })

      it('validates the merged result, not just the patch shape', async () => {
        const repo = await makeRepo()
        const m = await repo.movimientos.add(movimiento())
        await expect(repo.movimientos.update(m.id, { monto: -1 })).rejects.toMatchObject({
          code: 'invalid_input',
        })
      })
    })

    describe('remove()', () => {
      it('removes an existing row', async () => {
        const repo = await makeRepo()
        const m = await repo.movimientos.add(movimiento())
        await repo.movimientos.remove(m.id)
        await expect(repo.movimientos.get(m.id)).resolves.toBeUndefined()
      })

      it('rejects a missing id as not_found', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.remove('missing')).rejects.toMatchObject({
          code: 'not_found',
        })
      })
    })

    describe('addMany()', () => {
      it('adds every item', async () => {
        const repo = await makeRepo()
        const items = [movimiento(), movimiento(), movimiento()]
        const added = await repo.movimientos.addMany(items)
        expect(added).toHaveLength(3)
        const { items: stored } = await repo.movimientos.list()
        expect(stored).toHaveLength(3)
      })

      it('is all-or-nothing: an id that already exists rolls back the whole batch', async () => {
        const repo = await makeRepo()
        const dup = await repo.movimientos.add(movimiento())
        await expect(
          repo.movimientos.addMany([movimiento(), { ...dup }, movimiento()]),
        ).rejects.toMatchObject({ code: 'invalid_input' })
        const { items } = await repo.movimientos.list()
        expect(items).toHaveLength(1) // only the original `dup` — batch fully rolled back
      })

      it('is all-or-nothing: a duplicate id within the batch itself rolls back the whole batch', async () => {
        const repo = await makeRepo()
        const selfDup = movimiento()
        await expect(
          repo.movimientos.addMany([movimiento(), selfDup, { ...selfDup }]),
        ).rejects.toMatchObject({ code: 'invalid_input' })
        const { items } = await repo.movimientos.list()
        expect(items).toHaveLength(0) // nothing committed, including the two non-conflicting rows
      })
    })

    describe('removeMany()', () => {
      it('removes every id', async () => {
        const repo = await makeRepo()
        const a = await repo.movimientos.add(movimiento())
        const b = await repo.movimientos.add(movimiento())
        await repo.movimientos.removeMany([a.id, b.id])
        const { items } = await repo.movimientos.list()
        expect(items).toHaveLength(0)
      })

      it('is all-or-nothing: one missing id rolls back the whole batch', async () => {
        const repo = await makeRepo()
        const a = await repo.movimientos.add(movimiento())
        await expect(repo.movimientos.removeMany([a.id, 'missing'])).rejects.toMatchObject({
          code: 'not_found',
        })
        const { items } = await repo.movimientos.list()
        expect(items).toHaveLength(1) // `a` was NOT removed despite being valid
      })
    })

    describe('movimientos validation', () => {
      it('rejects a non-positive monto', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.add(movimiento({ monto: 0 }))).rejects.toMatchObject({
          code: 'invalid_input',
        })
        await expect(repo.movimientos.add(movimiento({ monto: -5 }))).rejects.toMatchObject({
          code: 'invalid_input',
        })
      })

      it('rejects a non-finite monto (NaN, Infinity)', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.add(movimiento({ monto: Number.NaN }))).rejects.toMatchObject(
          { code: 'invalid_input' },
        )
        await expect(
          repo.movimientos.add(movimiento({ monto: Number.POSITIVE_INFINITY })),
        ).rejects.toMatchObject({ code: 'invalid_input' })
      })

      it('rejects a non-ISO fecha', async () => {
        const repo = await makeRepo()
        await expect(
          repo.movimientos.add(movimiento({ fecha: '01/01/2026' })),
        ).rejects.toMatchObject({ code: 'invalid_input' })
        await expect(
          repo.movimientos.add(movimiento({ fecha: '2026-13-40' })),
        ).rejects.toMatchObject({ code: 'invalid_input' })
      })

      it('rejects a missing moneda', async () => {
        const repo = await makeRepo()
        const bad = { ...movimiento(), moneda: undefined } as unknown as Movimiento
        await expect(repo.movimientos.add(bad)).rejects.toMatchObject({ code: 'invalid_input' })
      })

      it('accepts a real leap day fecha (2024-02-29)', async () => {
        const repo = await makeRepo()
        await expect(
          repo.movimientos.add(movimiento({ fecha: '2024-02-29' })),
        ).resolves.toMatchObject({ fecha: '2024-02-29' })
      })

      it('never silently coerces invalid input: a rejected add() writes nothing', async () => {
        const repo = await makeRepo()
        const bad = movimiento({ monto: -1 })
        await expect(repo.movimientos.add(bad)).rejects.toThrow()
        await expect(repo.movimientos.get(bad.id)).resolves.toBeUndefined()
      })
    })

    describe('activos validation', () => {
      it('rejects a non-ISO fechaActualizacion', async () => {
        const repo = await makeRepo()
        await expect(
          repo.activos.add(activo({ fechaActualizacion: '01/01/2026' })),
        ).rejects.toMatchObject({ code: 'invalid_input' })
      })

      it('rejects a missing moneda', async () => {
        const repo = await makeRepo()
        const bad = { ...activo(), moneda: undefined } as unknown as Activo
        await expect(repo.activos.add(bad)).rejects.toMatchObject({ code: 'invalid_input' })
      })

      it('rejects a negative or non-finite valorActual', async () => {
        const repo = await makeRepo()
        await expect(repo.activos.add(activo({ valorActual: -1 }))).rejects.toMatchObject({
          code: 'invalid_input',
        })
        await expect(repo.activos.add(activo({ valorActual: Number.NaN }))).rejects.toMatchObject({
          code: 'invalid_input',
        })
      })

      it('accepts valorActual: 0 — a legitimate value, not a validation failure', async () => {
        const repo = await makeRepo()
        await expect(repo.activos.add(activo({ valorActual: 0 }))).resolves.toMatchObject({
          valorActual: 0,
        })
      })
    })

    describe('list() — empty store', () => {
      it('returns { items: [] }, never an error', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.list()).resolves.toEqual({ items: [] })
      })
    })

    describe('list() — filtering', () => {
      it('dateFrom/dateTo are inclusive on fecha', async () => {
        const repo = await makeRepo()
        await repo.movimientos.add(movimiento({ fecha: '2026-01-01' }))
        await repo.movimientos.add(movimiento({ fecha: '2026-01-15' }))
        await repo.movimientos.add(movimiento({ fecha: '2026-01-31' }))
        const { items } = await repo.movimientos.list({
          dateFrom: '2026-01-01',
          dateTo: '2026-01-15',
        })
        expect(items.map((m) => m.fecha).toSorted()).toEqual(['2026-01-01', '2026-01-15'])
      })

      it('seccion filters by exact match', async () => {
        const repo = await makeRepo()
        await repo.movimientos.add(movimiento({ seccion: 'sec_personal' }))
        await repo.movimientos.add(movimiento({ seccion: 'sec_trabajo' }))
        const { items } = await repo.movimientos.list({ seccion: 'sec_trabajo' })
        expect(items).toHaveLength(1)
        expect(items[0]?.seccion).toBe('sec_trabajo')
      })
    })

    describe('list() — sorting', () => {
      it('defaults to the date field, newest first', async () => {
        const repo = await makeRepo()
        await repo.movimientos.add(movimiento({ fecha: '2026-01-01' }))
        await repo.movimientos.add(movimiento({ fecha: '2026-01-15' }))
        const { items } = await repo.movimientos.list()
        expect(items.map((m) => m.fecha)).toEqual(['2026-01-15', '2026-01-01'])
      })

      it('honors an explicit sortBy/sortDir', async () => {
        const repo = await makeRepo()
        await repo.movimientos.add(movimiento({ monto: 300 }))
        await repo.movimientos.add(movimiento({ monto: 100 }))
        await repo.movimientos.add(movimiento({ monto: 200 }))
        const { items } = await repo.movimientos.list({ sortBy: 'monto', sortDir: 'asc' })
        expect(items.map((m) => m.monto)).toEqual([100, 200, 300])
      })

      it('defaults sortDir to "desc" when sortBy is given explicitly but sortDir is not', async () => {
        const repo = await makeRepo()
        await repo.movimientos.add(movimiento({ monto: 100 }))
        await repo.movimientos.add(movimiento({ monto: 300 }))
        const { items } = await repo.movimientos.list({ sortBy: 'monto' })
        expect(items.map((m) => m.monto)).toEqual([300, 100])
      })

      // sortDir applies to the whole key tuple (primary field, tiebreak field,
      // final id fallback), not just the primary field — a real, reproduced
      // bug when the two levels disagreed on direction (specs.md §11,
      // 2026-08-18). The next two tests pin that contract for every
      // implementation, not just the one it was first found in.
      it('breaks ties on the tiebreak field, following sortDir uniformly', async () => {
        const repo = await makeRepo()
        const older = movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T08:00:00.000Z' })
        const newer = movimiento({ fecha: '2026-01-01', createdAt: '2026-01-01T09:00:00.000Z' })
        await repo.movimientos.addMany([newer, older])

        const desc = await repo.movimientos.list()
        expect(desc.items.map((m) => m.id)).toEqual([newer.id, older.id])
        const asc = await repo.movimientos.list({ sortDir: 'asc' })
        expect(asc.items.map((m) => m.id)).toEqual([older.id, newer.id])
      })

      it('breaks a full tie (same date AND tiebreak) deterministically by id, following sortDir', async () => {
        const repo = await makeRepo()
        const a = movimiento({
          fecha: '2026-01-01',
          createdAt: '2026-01-01T08:00:00.000Z',
          id: 'aaa',
        })
        const b = movimiento({
          fecha: '2026-01-01',
          createdAt: '2026-01-01T08:00:00.000Z',
          id: 'bbb',
        })
        await repo.movimientos.addMany([b, a])

        const desc = await repo.movimientos.list()
        expect(desc.items.map((m) => m.id)).toEqual(['bbb', 'aaa'])
        const asc = await repo.movimientos.list({ sortDir: 'asc' })
        expect(asc.items.map((m) => m.id)).toEqual(['aaa', 'bbb'])
      })
    })

    describe('list() — pagination', () => {
      it('rejects a malformed cursor as invalid_input rather than crashing', async () => {
        const repo = await makeRepo()
        await expect(repo.movimientos.list({ cursor: 'not-a-real-cursor' })).rejects.toMatchObject({
          code: 'invalid_input',
        })
      })

      it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects limit=%p as invalid_input rather than an ambiguous empty page',
        async (limit) => {
          const repo = await makeRepo()
          await repo.movimientos.add(movimiento())
          await expect(repo.movimientos.list({ limit })).rejects.toMatchObject({
            code: 'invalid_input',
          })
        },
      )

      it('accepts a positive integer limit', async () => {
        const repo = await makeRepo()
        await repo.movimientos.add(movimiento())
        const { items } = await repo.movimientos.list({ limit: 1 })
        expect(items).toHaveLength(1)
      })
    })

    describe('Config', () => {
      it('shallow-merges an updateConfig() patch, leaving other top-level keys untouched', async () => {
        const repo = await makeRepo()
        const before = await repo.getConfig()
        const updated = await repo.updateConfig({ secciones: [] })
        expect(updated.secciones).toEqual([])
        expect(updated.categorias).toEqual(before.categorias)
        expect(updated.preferencias).toEqual(before.preferencias)
      })

      it('rejects a caller-supplied schemaVersion, leaving the stored version unchanged', async () => {
        const repo = await makeRepo()
        const before = await repo.getConfig()
        await expect(repo.updateConfig({ schemaVersion: 999 })).rejects.toMatchObject({
          code: 'invalid_input',
        })
        const after = await repo.getConfig()
        expect(after.schemaVersion).toBe(before.schemaVersion)
      })

      it('getConfig() returns a fresh object: mutating the result never affects stored data', async () => {
        const repo = await makeRepo()
        const config = await repo.getConfig()
        const snapshot = [...config.secciones]
        config.secciones.push({ id: 'hack', nombre: 'x', orden: 99 })
        const again = await repo.getConfig()
        expect(again.secciones).toEqual(snapshot)
      })
    })
  })
}
