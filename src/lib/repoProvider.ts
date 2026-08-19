import { getActiveProfile, getProfileDatabase, touchLastUsed } from '@/lib/profiles'
import type { Repo } from '@/lib/repo'
import { fakeRepo } from '@/lib/repo.fake'
import { createLocalRepo } from '@/lib/repo.local'

// STUB(wave3): swap to the Drive-backed Repo once one exists — see
// docs/wave-2-plan.md §3.2. This is the single swap point: every screen
// reads through `getRepo()`, never importing repo.fake.ts/repo.local.ts
// directly, so that swap is a one-line change here. Deliberately NOT
// `getActiveProfileRepo()` below yet — see that function's own comment.
export const getRepo = (): Repo => fakeRepo

// The real per-profile binding specs.md §10.15 describes: resolves the
// active profile (device-scoped registry, `src/lib/profiles/`) and returns
// a `Repo` scoped to that profile's own database, so a guest and a
// signed-in account never share rows on the same device. Built and proven
// with tests (repoProvider.test.ts) but **not** called by `getRepo()`
// above — flipping the stub is gated on Wave 4's create UI existing
// (specs.md, "Wave 3 — staging and dependencies"): wiring this in today
// would leave the app showing an empty screen with no way to add anything.
export const getActiveProfileRepo = async (): Promise<Repo> => {
  const profile = await getActiveProfile()
  await touchLastUsed(profile.id)
  const database = getProfileDatabase(profile.databaseName)
  return createLocalRepo(database)
}
