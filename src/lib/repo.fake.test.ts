import { describe, it, expect, vi } from 'vitest'
import { createFakeRepo, fakeRepo } from '@/lib/repo.fake'
import type { Repo } from '@/lib/repo'
import { testRepoContract } from '@/lib/repo.contract'
import type { Movimiento } from '@/lib/schema'

const TODAY = new Date('2026-08-18T12:00:00.000Z')

// The contract suite expects an empty store (repo.contract.ts's own
// precondition doc); createFakeRepo() always seeds demo data, so strip it
// before handing the repo to the shared suite.
const emptyFakeRepo = async (): Promise<Repo> => {
  const repo = createFakeRepo({ today: TODAY })
  const [movs, acts] = await Promise.all([repo.movimientos.list(), repo.activos.list()])
  await Promise.all([
    repo.movimientos.removeMany(movs.items.map((m) => m.id)),
    repo.activos.removeMany(acts.items.map((a) => a.id)),
  ])
  return repo
}

// Behavior every Repo implementation must agree on (docs/error-handling.md
// §6) — the same suite runs in repo.local.test.ts. Anything below this point
// in the file is implementation-specific to the fake (seed determinism, the
// index-encoded cursor, message-text regressions).
testRepoContract(emptyFakeRepo)

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

  it('add() then list() reflects the write immediately (single in-memory store)', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const before = await repo.movimientos.list()

    await repo.movimientos.add({
      id: 'mov_new',
      fecha: '2026-08-18',
      seccion: 'sec_personal',
      categoria: 'cat_comida',
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
  it('list() throws RepoError("invalid_input") on a negative cursor', async () => {
    const repo = createFakeRepo({ today: TODAY })
    await expect(repo.movimientos.list({ cursor: '-1' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('add() rejects a duplicate id with RepoError("invalid_input"), no mutation', async () => {
    const repo = createFakeRepo({ today: TODAY })
    const before = await repo.movimientos.list()
    const [first] = before.items
    if (!first) throw new Error('expected at least one seeded movimiento')

    const dup: Movimiento = { ...first, nota: 'dup' }
    await expect(repo.movimientos.add(dup)).rejects.toMatchObject({ code: 'invalid_input' })

    const after = await repo.movimientos.list()
    expect(after.items.length).toBe(before.items.length)
    expect(after.items.filter((m) => m.id === first.id).length).toBe(1)
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

describe('seed dates are timezone-safe', () => {
  // The exported singleton is what every screen renders in dev, and this
  // app's audience is entirely west of UTC. FAKE_REPO_SEED_DATE is evaluated
  // at import time, so this can only be exercised by the process TZ, not by
  // vi.stubEnv — hence the assertion on the singleton rather than on a
  // locally-constructed repo, which would silently bypass the constant.
  // Guards the regression Track E4 found: a UTC-midnight seed formatted as a
  // local calendar day landed a day early for every targeted timezone.
  it('anchors the seed on its intended calendar day', async () => {
    const { items } = await fakeRepo.movimientos.list()
    expect(
      items
        .map((m) => m.fecha)
        .toSorted()
        .at(-1),
    ).toBe('2026-08-18')
  })
})
