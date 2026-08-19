import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { __resetReadyMemoForTests } from '@/lib/repo.local'
import { fakeRepo } from '@/lib/repo.fake'
import {
  __clearProfileDatabaseCacheForTests,
  __clearRegistryForTests,
  DEFAULT_PROFILE_ID,
  makeProfileDatabaseName,
  registerProfile,
  touchLastUsed,
} from '@/lib/profiles'
import { getActiveProfileRepo, getRepo } from '@/lib/repoProvider'
import type { Movimiento } from '@/lib/schema'

describe('getRepo()', () => {
  it('returns the shared fake repo singleton', () => {
    expect(getRepo()).toBe(fakeRepo)
  })

  it('returns the same instance across calls', () => {
    expect(getRepo()).toBe(getRepo())
  })
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

const GOOGLE_PROFILE_ID = 'google-repo-provider-test'
const googleProfileDatabaseName = makeProfileDatabaseName(GOOGLE_PROFILE_ID)

describe('getActiveProfileRepo() — the real per-profile binding (not wired into getRepo() yet)', () => {
  afterEach(async () => {
    await db.movimientos.clear()
    await db.config.clear()
    __resetReadyMemoForTests()
    await __clearRegistryForTests()
    __clearProfileDatabaseCacheForTests(googleProfileDatabaseName)
  })

  it('on a fresh device, resolves to a repo backed by the adopted kurobello database', async () => {
    const repo = await getActiveProfileRepo()
    const added = await repo.movimientos.add(movimiento())
    expect(await db.movimientos.get(added.id)).toBeDefined()
  })

  it('a guest (local) profile and a signed-in (google) profile read and write entirely separate stores', async () => {
    // Establishes the default/local profile as the active one first, same
    // as a guest using the app before ever signing in.
    const guestRepo = await getActiveProfileRepo()
    const guestMovimiento = await guestRepo.movimientos.add(movimiento())

    // Signing in registers a second profile and makes it the most recently
    // used — "nothing is ever replaced" (specs.md §10.15): the guest data
    // above stays exactly where it was.
    await registerProfile({
      id: GOOGLE_PROFILE_ID,
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: googleProfileDatabaseName,
    })
    await touchLastUsed(GOOGLE_PROFILE_ID)

    const googleRepo = await getActiveProfileRepo()
    const googleMovimiento = await googleRepo.movimientos.add(movimiento())

    expect(await googleRepo.movimientos.get(guestMovimiento.id)).toBeUndefined()
    expect(await guestRepo.movimientos.get(googleMovimiento.id)).toBeUndefined()
    expect(await db.movimientos.get(guestMovimiento.id)).toBeDefined()
    expect(await db.movimientos.get(googleMovimiento.id)).toBeUndefined()

    // Switching back (touchLastUsed again, standing in for a future
    // profile switcher, Wave 5+) reaches the guest data untouched.
    await touchLastUsed(DEFAULT_PROFILE_ID)
    const guestRepoAgain = await getActiveProfileRepo()
    expect(await guestRepoAgain.movimientos.get(guestMovimiento.id)).toBeDefined()
  })
})
