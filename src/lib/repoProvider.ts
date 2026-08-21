import { getActiveProfile, getProfileDatabase, touchLastUsed } from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import { ensureOwnerMarker } from '@/lib/profiles/profileOwner'
import type { ProfileDb } from '@/lib/db'
import type { Repo } from '@/lib/repo'
import { createLocalRepo } from '@/lib/repo.local'

// The real per-profile binding specs.md §10.15 describes and §10.28's boot
// sequence establishes: resolves the active profile (device-scoped
// registry, `src/lib/profiles/`), opens its own database, and returns a
// `Repo` scoped to it, so a guest and a signed-in account never share rows
// on the same device.
export interface ProfileBinding {
  profile: ProfileRecord
  database: ProfileDb
  repo: Repo
}

export const resolveActiveProfileBinding = async (): Promise<ProfileBinding> => {
  const profile = await getActiveProfile()
  await touchLastUsed(profile.id)
  const database = getProfileDatabase(profile.databaseName)
  // specs.md §10.31 §2: every bind ensures this database's own owner marker
  // exists — idempotent, so a profile bound many times over its life only
  // ever writes this once. Self-catching (never throws) and awaited so the
  // write has landed before this binding is handed back — the switcher's
  // pre-switch "is the target's database gone" check reads this same
  // marker on a *different* profile before calling this function for it,
  // so ordering here only matters for this profile's own next read, not a
  // race with the switcher.
  await ensureOwnerMarker(database, {
    kind: profile.kind,
    accountKey: profile.accountKey,
    createdAt: profile.createdAt,
  })
  const repo = createLocalRepo(database)
  return { profile, database, repo }
}

/** Convenience wrapper for a caller that only wants the repo, not the full binding. */
export const getActiveProfileRepo = async (): Promise<Repo> =>
  (await resolveActiveProfileBinding()).repo

// The one place the binding `getRepo()` below serves is actually set
// (specs.md §10.28's boot sequence, `src/lib/boot.ts`) — established once
// before the app renders, and rebuilt whenever a fresh boot resolves a
// different profile (signing out and into a different account), never left
// stale.
let binding: ProfileBinding | null = null

export const bindActiveProfile = (next: ProfileBinding): void => {
  binding = next
}

/** Read by boot.ts to decide whether a resolved profile is the one already bound (specs.md §10.28's rebind edge case), and by getRepo() below. `null` before the first successful boot. */
export const getActiveProfileBinding = (): ProfileBinding | null => binding

// The flip (specs.md §10.25): every screen reads through this single swap
// point, never importing repo.fake.ts/repo.local.ts directly. It stays
// synchronous — the resolve-once-at-boot shape the §10.25 addendum
// recommends over making all nine call sites `await` a value that could
// each resolve a *different* profile if the active one changed mid-call.
//
// A caller reaching this before the boot sequence has bound a profile gets
// a loud throw, never the fake repo as a fallback: a silent fallback here
// would write a user's money into an in-memory store that evaporates on
// the next reload — precisely the failure the flip exists to end.
export const getRepo = (): Repo => {
  if (!binding) {
    throw new Error(
      'repoProvider.getRepo() was called before the boot sequence bound an active profile ' +
        '(src/lib/boot.ts) — every screen renders behind BootGate, so this means a caller ' +
        'reached the repo outside that gate.',
    )
  }
  return binding.repo
}

export const __resetRepoBindingForTests = (): void => {
  binding = null
}
