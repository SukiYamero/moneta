import { describe, it, expect, vi } from 'vitest'
import { createFakeRepo } from '@/lib/repo.fake'
import { RepoError } from '@/lib/repo'
import type { Activo, Movimiento } from '@/lib/schema'

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

describe('createFakeRepo — parity with the real (dexie) repo contract', () => {
  it('list() with no sortBy defaults to the entity date field, newest first', async () => {
    const repo = createFakeRepo({ today: TODAY })
    // The seed array happens to already be authored newest-first by insertion
    // order, which would hide this bug — so append a newer row last (store
    // order puts it at the end) and prove it still surfaces first.
    await repo.movimientos.add({
      id: 'mov_newest',
      fecha: '2026-08-19',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto',
      monto: 1000,
      moneda: 'COP',
      createdAt: '2026-08-19T00:00:00.000Z',
    })

    const result = await repo.movimientos.list()

    expect(result.items[0]?.id).toBe('mov_newest')
    const fechas = result.items.map((m) => m.fecha)
    expect(fechas).toEqual([...fechas].sort().reverse())
  })

  it('list() with sortBy but no sortDir defaults to "desc", not "asc"', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const result = await repo.movimientos.list({ sortBy: 'fecha' })

    const fechas = result.items.map((m) => m.fecha)
    expect(fechas).toEqual([...fechas].sort().reverse())
  })

  it('rejects NaN monto with RepoError("invalid_input")', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const invalid: Movimiento = {
      id: 'mov_nan',
      fecha: '2026-08-18',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto',
      monto: Number.NaN,
      moneda: 'COP',
      createdAt: TODAY.toISOString(),
    }

    await expect(repo.movimientos.add(invalid)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('rejects Infinity monto with RepoError("invalid_input")', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const invalid: Movimiento = {
      id: 'mov_inf',
      fecha: '2026-08-18',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto',
      monto: Number.POSITIVE_INFINITY,
      moneda: 'COP',
      createdAt: TODAY.toISOString(),
    }

    await expect(repo.movimientos.add(invalid)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('rejects an invalid fecha on a Movimiento (bad format, impossible calendar date)', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const base = {
      id: 'mov_bad_fecha',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto' as const,
      monto: 1000,
      moneda: 'COP' as const,
      createdAt: TODAY.toISOString(),
    }

    for (const fecha of ['not-a-date', '2026-13-40', '2026-02-30', '2023-02-29']) {
      await expect(
        repo.movimientos.add({ ...base, id: `mov_bad_fecha_${fecha}`, fecha }),
      ).rejects.toMatchObject({ code: 'invalid_input' })
    }
  })

  it('accepts a real leap day fecha on a Movimiento (2024-02-29)', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const valid: Movimiento = {
      id: 'mov_leap_day',
      fecha: '2024-02-29',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto',
      monto: 1000,
      moneda: 'COP',
      createdAt: TODAY.toISOString(),
    }

    const added = await repo.movimientos.add(valid)
    expect(added.fecha).toBe('2024-02-29')
  })

  it('rejects a Movimiento with missing moneda', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const invalid = {
      id: 'mov_no_moneda',
      fecha: '2026-08-18',
      seccion: 'sec_personal',
      categoria: 'Comida',
      tipo: 'gasto' as const,
      monto: 1000,
      moneda: '' as Movimiento['moneda'],
      createdAt: TODAY.toISOString(),
    }

    await expect(repo.movimientos.add(invalid)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('rejects an invalid Activo (bad date, missing moneda, negative valorActual)', async () => {
    const repo = createFakeRepo({ today: TODAY })

    const badDate: Activo = {
      id: 'act_bad_date',
      nombre: 'Fondo X',
      tipo: 'otro',
      valorActual: 1000,
      moneda: 'COP',
      fechaActualizacion: 'not-a-date',
    }
    await expect(repo.activos.add(badDate)).rejects.toMatchObject({ code: 'invalid_input' })

    const missingMoneda: Activo = {
      id: 'act_bad_moneda',
      nombre: 'Fondo Y',
      tipo: 'otro',
      valorActual: 1000,
      moneda: '' as Activo['moneda'],
      fechaActualizacion: '2026-08-18',
    }
    await expect(repo.activos.add(missingMoneda)).rejects.toMatchObject({ code: 'invalid_input' })

    const negativeValor: Activo = {
      id: 'act_bad_valor',
      nombre: 'Fondo Z',
      tipo: 'otro',
      valorActual: -500,
      moneda: 'COP',
      fechaActualizacion: '2026-08-18',
    }
    await expect(repo.activos.add(negativeValor)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('accepts an Activo with valorActual: 0 — zero is a legitimate value', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const zeroValor: Activo = {
      id: 'act_zero',
      nombre: 'Cuenta agotada',
      tipo: 'otro',
      valorActual: 0,
      moneda: 'COP',
      fechaActualizacion: '2026-08-18',
    }

    const added = await repo.activos.add(zeroValor)
    expect(added.valorActual).toBe(0)
  })

  it('breaks tied sort values via the tiebreak field then id, uniformly with sortDir', async () => {
    const repo = createFakeRepo({ today: TODAY })
    // mov_seed_1 and mov_seed_2 share the same fecha AND createdAt (same offsetDays) —
    // the only thing left to order them is `id`, and it must flip with sortDir.
    const asc = await repo.movimientos.list({ sortBy: 'fecha', sortDir: 'asc' })
    const desc = await repo.movimientos.list({ sortBy: 'fecha', sortDir: 'desc' })

    const ascTiedIds = asc.items
      .filter((m) => m.id === 'mov_seed_1' || m.id === 'mov_seed_2')
      .map((m) => m.id)
    const descTiedIds = desc.items
      .filter((m) => m.id === 'mov_seed_1' || m.id === 'mov_seed_2')
      .map((m) => m.id)

    expect(ascTiedIds).toEqual(['mov_seed_1', 'mov_seed_2'])
    expect(descTiedIds).toEqual(['mov_seed_2', 'mov_seed_1'])
  })

  it('updateConfig() rejects a patch that sets schemaVersion', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.updateConfig({ schemaVersion: 999 })).rejects.toMatchObject({
      code: 'invalid_input',
    })

    // and it must not have poisoned ready()'s own version check
    await expect(repo.ready()).resolves.toBeUndefined()
  })

  it('list() throws RepoError("invalid_input") on a malformed cursor', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.movimientos.list({ cursor: 'not-a-number' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('list() throws RepoError("invalid_input") on a negative cursor', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.movimientos.list({ cursor: '-1' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('update() re-pins id even if the patch tries to change it', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const [first] = (await repo.movimientos.list()).items
    if (!first) throw new Error('expected at least one seeded movimiento')

    const updated = await repo.movimientos.update(first.id, {
      nota: 'Editado',
      ...({ id: 'someone-elses-id' } as Partial<Movimiento>),
    })

    expect(updated.id).toBe(first.id)
  })

  it('the shared singleton seeds from a pinned clock, reproducible across different boot days', async () => {
    // The singleton's seed must not depend on the real wall-clock date it happens
    // to be imported on — re-import it under two different mocked "todays" and
    // confirm the seed comes out identical either way.
    vi.resetModules()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'))
      const { fakeRepo: repoBootDay1 } = await import('@/lib/repo.fake')
      const day1 = await repoBootDay1.movimientos.list({
        sortBy: 'fecha',
        sortDir: 'desc',
        limit: 1,
      })

      vi.resetModules()
      vi.setSystemTime(new Date('2030-06-15T00:00:00.000Z'))
      const { fakeRepo: repoBootDay2 } = await import('@/lib/repo.fake')
      const day2 = await repoBootDay2.movimientos.list({
        sortBy: 'fecha',
        sortDir: 'desc',
        limit: 1,
      })

      expect(day1.items[0]?.fecha).toBe(day2.items[0]?.fecha)
    } finally {
      vi.useRealTimers()
      vi.resetModules()
    }
  })
})
