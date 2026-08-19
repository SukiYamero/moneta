import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))
vi.mock('@/lib/export/delivery', () => ({ deliverCsv: vi.fn(() => Promise.resolve()) }))

import type { ListQuery, ListResult, Repo } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import type { Movimiento } from '@/lib/schema'
import { deliverCsv } from '@/lib/export/delivery'
import { buildExportFilename, exportMovimientosToCsv } from '@/lib/export'

const mGetRepo = vi.mocked(getRepo)
const mDeliverCsv = vi.mocked(deliverCsv)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

// A minimal Repo stub with a caller-supplied movimientos.list(); every other
// method rejects, so a test fails loudly if the orchestrator calls one it
// shouldn't.
const repoStubWithList = (list: Repo['movimientos']['list']): Repo => {
  const notUsed = (): Promise<never> => Promise.reject(new Error('not used by this test'))
  return {
    ready: () => Promise.resolve(),
    movimientos: {
      list,
      get: notUsed,
      add: notUsed,
      addMany: notUsed,
      update: notUsed,
      remove: notUsed,
      removeMany: notUsed,
    },
    activos: {
      list: notUsed,
      get: notUsed,
      add: notUsed,
      addMany: notUsed,
      update: notUsed,
      remove: notUsed,
      removeMany: notUsed,
    },
    getConfig: notUsed,
    updateConfig: notUsed,
  }
}

// Deliberately not honouring the caller's `limit`, so the orchestrator's
// pagination loop is genuinely exercised across several pages instead of
// being satisfied by one call (the same reasoning index.ts itself gives for
// not trusting a limit-less list() to return everything).
const repoStubWithPages = (all: Movimiento[], maxPageSize: number): Repo =>
  repoStubWithList((query?: ListQuery<Movimiento>): Promise<ListResult<Movimiento>> => {
    const start = query?.cursor ? Number(query.cursor) : 0
    const page = all.slice(start, start + maxPageSize)
    const nextIndex = start + maxPageSize
    return Promise.resolve({
      items: page,
      nextCursor: nextIndex < all.length ? String(nextIndex) : undefined,
    })
  })

beforeEach(() => {
  mDeliverCsv.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildExportFilename()', () => {
  it('carries the app name and the date, in ISO order', () => {
    expect(buildExportFilename(new Date(2026, 7, 19))).toBe('kurobello-movimientos-2026-08-19.csv')
  })

  it('zero-pads single-digit months and days', () => {
    expect(buildExportFilename(new Date(2026, 0, 5))).toBe('kurobello-movimientos-2026-01-05.csv')
  })
})

describe('exportMovimientosToCsv()', () => {
  it('pages through every movimiento in the repo and delivers one CSV containing all of them', async () => {
    const all = Array.from({ length: 7 }, (_, i) => movimiento({ id: `m${i}` }))
    const repo = repoStubWithPages(all, 3)
    const listSpy = vi.spyOn(repo.movimientos, 'list')
    mGetRepo.mockReturnValue(repo)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 19, 12, 0, 0))

    await exportMovimientosToCsv({ locale: 'es-CO' })

    expect(mDeliverCsv).toHaveBeenCalledTimes(1)
    const call = mDeliverCsv.mock.calls[0]![0]
    expect(call.filename).toBe('kurobello-movimientos-2026-08-19.csv')
    const csv = call.parts.join('')
    for (const item of all) {
      expect(csv).toContain(`${item.id};`)
    }
    // Every page after the first was issued with the same sortBy/sortDir as
    // the first (docs/error-handling.md §4: a cursor replayed under a
    // different sort is rejected as invalid_input, not silently answered).
    for (const [query] of listSpy.mock.calls) {
      expect(query).toMatchObject({ sortBy: 'fecha', sortDir: 'asc' })
    }
  })

  it('stops paging on an empty page even if the Repo keeps returning a nextCursor, rather than looping forever', async () => {
    const all = Array.from({ length: 3 }, (_, i) => movimiento({ id: `m${i}` }))
    // A misbehaving Repo (the port makes no promise the last page's cursor
    // is `undefined`) that returns an empty page but still sets nextCursor.
    const list = vi.fn((query?: ListQuery<Movimiento>): Promise<ListResult<Movimiento>> => {
      const start = query?.cursor ? Number(query.cursor) : 0
      const page = all.slice(start, start + 3)
      return Promise.resolve({ items: page, nextCursor: 'stuck-cursor' })
    })
    mGetRepo.mockReturnValue(repoStubWithList(list))

    await exportMovimientosToCsv({ locale: 'es-CO' })

    expect(list).toHaveBeenCalledTimes(2)
    const csv = mDeliverCsv.mock.calls[0]![0].parts.join('')
    for (const item of all) {
      expect(csv).toContain(`${item.id};`)
    }
  })

  it('delivers a header-only CSV when there are no movimientos, not an error', async () => {
    const repo = repoStubWithPages([], 500)
    mGetRepo.mockReturnValue(repo)

    await expect(exportMovimientosToCsv({ locale: 'es-CO' })).resolves.toBeUndefined()

    const csv = mDeliverCsv.mock.calls[0]![0].parts.join('')
    expect(csv).toContain('id;fecha;seccion;categoria;tipo;monto;moneda;metodo;nota;createdAt')
    expect(csv.split('\r\n')).toHaveLength(3) // sep line, header, trailing empty
  })

  it('awaits repo.ready() before listing', async () => {
    const repo = repoStubWithPages([], 500)
    const readySpy = vi.spyOn(repo, 'ready')
    mGetRepo.mockReturnValue(repo)

    await exportMovimientosToCsv({ locale: 'es-CO' })

    expect(readySpy).toHaveBeenCalled()
  })
})
