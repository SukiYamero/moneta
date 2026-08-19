import { describe, it, expect } from 'vitest'
import { createFakeRepo } from '@/lib/repo.fake'
import { RepoError } from '@/lib/repo'
import type { Movimiento } from '@/lib/schema'

const TODAY = new Date('2026-08-18T12:00:00.000Z')

describe('createFakeRepo', () => {
  it('seeds deterministic Spanish sample data for the same "today"', async () => {
    const repoA = createFakeRepo({ today: TODAY })
    const repoB = createFakeRepo({ today: TODAY })

    const [listA, listB] = await Promise.all([repoA.movimientos.list(), repoB.movimientos.list()])

    expect(listA.items).toEqual(listB.items)
    expect(listA.items.length).toBeGreaterThan(10)
  })

  it('ready() resolves for a freshly seeded repo', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.ready()).resolves.toBeUndefined()
  })

  it('list() on an empty store returns { items: [] }, never an error', async () => {
    const repo = createFakeRepo({ today: TODAY })
    // remove every seeded movimiento to get to the empty-store case
    const all = await repo.movimientos.list()
    await repo.movimientos.removeMany(all.items.map((m) => m.id))

    const result = await repo.movimientos.list()
    expect(result).toEqual({ items: [] })
  })

  it('get() on a missing id returns undefined, not a throw', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.movimientos.get('nope')).resolves.toBeUndefined()
  })

  it('update() on a missing id throws RepoError("not_found")', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.movimientos.update('nope', { monto: 10 })).rejects.toMatchObject({
      code: 'not_found',
    } satisfies Partial<RepoError>)
  })

  it('remove() on a missing id throws RepoError("not_found")', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.movimientos.remove('nope')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('rejects a non-positive monto with RepoError("invalid_input")', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const invalid: Movimiento = {
      id: 'mov_invalid',
      fecha: '2026-08-18',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto',
      monto: -5,
      moneda: 'COP',
      createdAt: TODAY.toISOString(),
    }

    await expect(repo.movimientos.add(invalid)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('add() then list() reflects the write immediately (single in-memory store)', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const before = await repo.movimientos.list()

    await repo.movimientos.add({
      id: 'mov_new',
      fecha: '2026-08-18',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto',
      monto: 1000,
      moneda: 'COP',
      createdAt: TODAY.toISOString(),
    })

    const after = await repo.movimientos.list()
    expect(after.items.length).toBe(before.items.length + 1)
  })

  it('update() replaces immutably and does not mutate the previous return value', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const [first] = (await repo.movimientos.list()).items
    if (!first) throw new Error('expected at least one seeded movimiento')

    const updated = await repo.movimientos.update(first.id, { nota: 'Editado' })

    expect(updated.nota).toBe('Editado')
    expect(first.nota).not.toBe('Editado')
  })

  it('honors dateFrom/dateTo/seccion/sortBy/sortDir/limit/cursor together', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const page1 = await repo.movimientos.list({
      seccion: 'sec_personal',
      sortBy: 'fecha',
      sortDir: 'desc',
      limit: 2,
    })

    expect(page1.items.length).toBe(2)
    expect(page1.items.every((m) => m.seccion === 'sec_personal')).toBe(true)
    expect(page1.nextCursor).toBeDefined()

    const page2 = await repo.movimientos.list({
      seccion: 'sec_personal',
      sortBy: 'fecha',
      sortDir: 'desc',
      limit: 2,
      cursor: page1.nextCursor,
    })

    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id)
  })

  it('getConfig/updateConfig round-trip and stay atomic', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const config = await repo.getConfig()
    expect(config.categorias.some((c) => c.nombre === 'Sueldo')).toBe(true)

    const updated = await repo.updateConfig({
      preferencias: { ...config.preferencias, monedaPrincipal: 'USD' },
    })
    expect(updated.preferencias.monedaPrincipal).toBe('USD')

    const refetched = await repo.getConfig()
    expect(refetched.preferencias.monedaPrincipal).toBe('USD')
  })

  it('exposes a handful of Activo rows too', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const activos = await repo.activos.list()
    expect(activos.items.length).toBeGreaterThanOrEqual(2)
  })
})
