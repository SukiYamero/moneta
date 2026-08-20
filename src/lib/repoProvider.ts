import { getActiveProfile, getProfileDatabase, touchLastUsed } from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import type { ProfileDb } from '@/lib/db'
import type { Repo } from '@/lib/repo'
import { fakeRepo } from '@/lib/repo.fake'
import { createLocalRepo } from '@/lib/repo.local'

// STUB(wave3): swap to the Drive-backed Repo once one exists — see
// docs/wave-2-plan.md §3.2. This is the single swap point: every screen
// reads through `getRepo()`, never importing repo.fake.ts/repo.local.ts
// directly, so that swap is a one-line change here. Deliberately NOT
// resolveActiveProfileBinding() below yet — see that function's own comment.
export const getRepo = (): Repo => fakeRepo

// The real per-profile binding specs.md §10.15 describes and §10.28 wires
// into boot: resolves the active profile (device-scoped registry,
// `src/lib/profiles/`), opens its own database, and returns a `Repo` scoped
// to it, so a guest and a signed-in account never share rows on the same
// device. Built and proven with tests (repoProvider.test.ts) but **not**
// yet what `getRepo()` above serves — flipping the stub is gated on Wave
// 4's create UI existing (specs.md, "Wave 3 — staging and dependencies"):
// wiring this in before then would leave the app showing an empty screen
// with no way to add anything.
export interface ProfileBinding {
  profile: ProfileRecord
  database: ProfileDb
  repo: Repo
}

export const resolveActiveProfileBinding = async (): Promise<ProfileBinding> => {
  const profile = await getActiveProfile()
  await touchLastUsed(profile.id)
  const database = getProfileDatabase(profile.databaseName)
  const repo = createLocalRepo(database)
  return { profile, database, repo }
}

/** Convenience wrapper for a caller that only wants the repo, not the full binding. */
export const getActiveProfileRepo = async (): Promise<Repo> =>
  (await resolveActiveProfileBinding()).repo

// The one place `getRepo()`'s binding is actually set (specs.md §10.28's
// boot sequence, `src/lib/boot.ts`) — established once before the app
// renders, and rebuilt whenever a fresh boot resolves a different profile
// (signing out and into a different account), never left stale. Not yet
// read by `getRepo()` above; that's the flip itself (specs.md §10.25).
let binding: ProfileBinding | null = null

export const bindActiveProfile = (next: ProfileBinding): void => {
  binding = next
}

/** The binding `getRepo()` will serve once the stub above is flipped — read by boot.ts to decide whether a resolved profile is the one already bound (specs.md §10.28's rebind edge case), and by tests. `undefined` before the first successful boot. */
export const getActiveProfileBinding = (): ProfileBinding | null => binding

export const __resetRepoBindingForTests = (): void => {
  binding = null
}
