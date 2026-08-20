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
import {
  bindActiveProfile,
  getActiveProfileBinding,
  getActiveProfileRepo,
  getRepo,
  resolveActiveProfileBinding,
  __resetRepoBindingForTests,
} from '@/lib/repoProvider'
import type { Movimiento } from '@/lib/schema'

// specs.md §10.25/§10.28: the flip. getRepo() now serves the binding
// src/lib/boot.ts establishes, never the fake repo, and never a silent
// fallback if a caller reaches it before the boot sequence has run.
describe('getRepo()', () => {
  afterEach(() => {
    __resetRepoBindingForTests()
  })

  it('throws loudly, never falling back to the fake repo, when called before the boot sequence binds a profile', () => {
    expect(() => getRepo()).toThrow(/boot sequence/)
  })

  it('returns the bound profile-scoped repo once bindActiveProfile() has run', async () => {
    const binding = await resolveActiveProfileBinding()
    bindActiveProfile(binding)

    expect(getRepo()).toBe(binding.repo)
    expect(getRepo()).not.toBe(fakeRepo)
  })

  it('returns the same instance across calls once bound', async () => {
    bindActiveProfile(await resolveActiveProfileBinding())
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

describe("getActiveProfileRepo() — resolves fresh every call, independent of getRepo()'s bound singleton", () => {
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

// specs.md §10.28: the binding boot.ts establishes — separate from
// getActiveProfileRepo() above, which resolves fresh every call and binds
// nothing. getRepo() does not read this yet (that is the flip, specs.md
// §10.25); these tests only cover the binding's own bookkeeping.
describe('the active-profile binding (specs.md §10.28 — this is what getRepo() now serves)', () => {
  afterEach(async () => {
    __resetRepoBindingForTests()
    await db.movimientos.clear()
    await db.config.clear()
    __resetReadyMemoForTests()
    await __clearRegistryForTests()
  })

  it('is null before the first bind', () => {
    expect(getActiveProfileBinding()).toBeNull()
  })

  it('resolveActiveProfileBinding() resolves the profile, database and repo together', async () => {
    const binding = await resolveActiveProfileBinding()
    expect(binding.profile.id).toBe(DEFAULT_PROFILE_ID)
    expect(binding.database).toBe(db)
    const added = await binding.repo.movimientos.add(movimiento())
    expect(await db.movimientos.get(added.id)).toBeDefined()
  })

  it('bindActiveProfile() makes the binding readable via getActiveProfileBinding()', async () => {
    const binding = await resolveActiveProfileBinding()
    bindActiveProfile(binding)
    expect(getActiveProfileBinding()).toBe(binding)
  })

  // specs.md §10.28's "two tabs open at once" edge case: both boot
  // sequences call resolveActiveProfileBinding() independently (no shared
  // in-memory state across tabs) and must both land on the same profile,
  // with neither losing the other's touchLastUsed() write — the same
  // strictly-increasing-timestamp guarantee profileRegistry.test.ts already
  // proves for touchLastUsed() itself, exercised here through the binding
  // both tabs would actually call.
  it('two concurrent resolutions (two tabs) both resolve the same profile, neither losing the other’s touch', async () => {
    const [bindingA, bindingB] = await Promise.all([
      resolveActiveProfileBinding(),
      resolveActiveProfileBinding(),
    ])
    expect(bindingA.profile.id).toBe(DEFAULT_PROFILE_ID)
    expect(bindingB.profile.id).toBe(DEFAULT_PROFILE_ID)
  })
})
