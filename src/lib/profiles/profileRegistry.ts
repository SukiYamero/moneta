import Dexie, { type EntityTable } from 'dexie'

export type ProfileKind = 'local' | 'google'

export interface ProfileRecord {
  id: string
  label: string
  kind: ProfileKind
  databaseName: string
  createdAt: string
  lastUsedAt: string
}

type ProfileRegistryDb = Dexie & {
  profiles: EntityTable<ProfileRecord, 'id'>
}

// A separate, tiny Dexie database — same posture as src/lib/deviceStore.ts's
// own `kurobello-device`, not a table bolted onto a profile's own database
// (`db.ts`'s `kurobello`, frozen per AGENTS.md). The registry lists profiles;
// it never holds a profile's actual data. Name is suffixed off the frozen
// `kurobello` base (AGENTS.md § Branding vs storage identifiers) and, once
// this ships to a real device, is itself frozen the same way.
export const PROFILE_REGISTRY_DB_NAME = 'kurobello-profiles' as const

export const profileRegistryDb = new Dexie(PROFILE_REGISTRY_DB_NAME) as ProfileRegistryDb
profileRegistryDb.version(1).stores({ profiles: 'id, kind, lastUsedAt' })

// The existing `kurobello` database is *adopted* as the first profile
// (AGENTS.md, specs.md §10.15) — never migrated, never renamed. Every later
// profile mints a fresh id and a `kurobello-<id>` database name instead of
// touching this one.
export const DEFAULT_PROFILE_ID = 'kurobello' as const
export const DEFAULT_PROFILE_DATABASE_NAME = 'kurobello' as const

export const makeProfileDatabaseName = (profileId: string): string => `kurobello-${profileId}`

const nowIso = (): string => new Date().toISOString()

const bumpIso = (iso: string): string => new Date(new Date(iso).getTime() + 1).toISOString()

// Guarantees the returned timestamp strictly exceeds every `lastUsedAt`
// already in the registry. Millisecond-resolution wall time alone isn't
// reliable here: two touches issued back-to-back (fast automated flows, or
// two IndexedDB writes that both settle inside the same tick — observed in
// this module's own tests) can land in the same millisecond, and
// `getActiveProfile()`'s "most recent wins" comparison needs a strict,
// never-tied ordering to stay deterministic.
const nextLastUsedAt = (existing: ProfileRecord[]): string => {
  const maxExisting = existing.reduce((max, p) => (p.lastUsedAt > max ? p.lastUsedAt : max), '')
  const candidate = nowIso()
  return candidate > maxExisting ? candidate : bumpIso(maxExisting)
}

const defaultProfileRecord = (): ProfileRecord => {
  const timestamp = nowIso()
  return {
    id: DEFAULT_PROFILE_ID,
    label: 'Local',
    kind: 'local',
    databaseName: DEFAULT_PROFILE_DATABASE_NAME,
    createdAt: timestamp,
    lastUsedAt: timestamp,
  }
}

// Every read/write here self-catches and degrades to "no signal recorded" —
// same posture as every other device signal (deviceStore.ts, specs.md
// §10.15): storage trouble may suppress a convenience, must never block
// boot.
export const listProfiles = async (): Promise<ProfileRecord[]> => {
  try {
    return await profileRegistryDb.profiles.toArray()
  } catch (e) {
    console.warn('profiles: could not read the registry, treating as empty', e)
    return []
  }
}

export const getProfile = async (id: string): Promise<ProfileRecord | undefined> => {
  try {
    return await profileRegistryDb.profiles.get(id)
  } catch (e) {
    console.warn(`profiles: could not read profile "${id}"`, e)
    return undefined
  }
}

export interface RegisterProfileInput {
  id: string
  label: string
  kind: ProfileKind
  databaseName: string
}

// No caller exists yet (Wave 5+ owns sign-in registering a profile) — this
// is deliberately not wrapped in a self-catching swallow: a caller that
// asked to register a profile needs to know if it didn't happen, unlike the
// read-side "degrade to no signal" posture above. Read-then-write inside one
// transaction (same atomicity treatment as repo.local.ts's update()/
// remove()): two concurrent registrations must each see the other's
// existing rows when computing a strictly-increasing `lastUsedAt`, or a
// get-then-put race could hand both the same candidate timestamp.
export const registerProfile = async (input: RegisterProfileInput): Promise<ProfileRecord> => {
  return profileRegistryDb.transaction('rw', profileRegistryDb.profiles, async () => {
    const existing = await profileRegistryDb.profiles.toArray()
    const record: ProfileRecord = {
      ...input,
      createdAt: nowIso(),
      lastUsedAt: nextLastUsedAt(existing),
    }
    await profileRegistryDb.profiles.put(record)
    return record
  })
}

export const touchLastUsed = async (id: string): Promise<void> => {
  try {
    await profileRegistryDb.transaction('rw', profileRegistryDb.profiles, async () => {
      const existing = await profileRegistryDb.profiles.toArray()
      await profileRegistryDb.profiles.update(id, { lastUsedAt: nextLastUsedAt(existing) })
    })
  } catch (e) {
    // Best-effort, same posture as deviceStore.ts's markLoggedIn: losing
    // this write just means recency-based active-profile selection is
    // slightly stale next read, not that anything already saved is lost.
    console.warn(`profiles: could not update last-used for "${id}"`, e)
  }
}

// No switcher UI exists yet (Wave 5+, specs.md §10.15) — recency is the only
// signal available to pick "the" active profile. This both lazily adopts
// the frozen kurobello database as the first-ever registry row (a device
// that never wrote one gets it created here, on first read) and returns
// whichever profile was used most recently.
export const getActiveProfile = async (): Promise<ProfileRecord> => {
  const existing = await listProfiles()
  if (existing.length === 0) {
    const record = defaultProfileRecord()
    try {
      await profileRegistryDb.profiles.put(record)
    } catch (e) {
      // Best-effort: a registry write failure must not block resolving a
      // working repo — the caller still gets a valid record pointing at
      // the frozen kurobello database even if it isn't persisted this run.
      console.warn('profiles: could not persist the default profile record', e)
    }
    return record
  }
  return existing.reduce((latest, candidate) =>
    candidate.lastUsedAt > latest.lastUsedAt ? candidate : latest,
  )
}

// Test-only escape hatch, same posture as repo.local.ts's
// __resetReadyMemoForTests: `profileRegistryDb` is a module singleton
// reused across a whole test file. Not exported from any public surface.
export const __clearRegistryForTests = async (): Promise<void> => {
  await profileRegistryDb.profiles.clear()
}
