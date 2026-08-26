import { getActiveProfile, getProfileDatabase, touchLastUsed } from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import { ensureOwnerMarker } from '@/lib/profiles/profileOwner'
import type { ProfileDb } from '@/lib/db'
import type { Repo } from '@/lib/repo'
import { createLocalRepo } from '@/lib/repo.local'

export interface ProfileBinding {
  profile: ProfileRecord
  database: ProfileDb
  repo: Repo
}

export const resolveActiveProfileBinding = async (): Promise<ProfileBinding> => {
  const profile = await getActiveProfile()
  await touchLastUsed(profile.id)
  const database = getProfileDatabase(profile.databaseName)
  await ensureOwnerMarker(database, {
    kind: profile.kind,
    accountKey: profile.accountKey,
    createdAt: profile.createdAt,
  })
  const repo = createLocalRepo(database)
  return { profile, database, repo }
}

export const getActiveProfileRepo = async (): Promise<Repo> =>
  (await resolveActiveProfileBinding()).repo

let binding: ProfileBinding | null = null

export const bindActiveProfile = (next: ProfileBinding): void => {
  binding = next
}

export const getActiveProfileBinding = (): ProfileBinding | null => binding

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
