import { deviceDb } from '@/lib/deviceStore'

export type ProfileKind = 'local' | 'google'

export interface ProfileRecord {
  id: string
  label: string
  kind: ProfileKind
  databaseName: string
  createdAt: string
  lastUsedAt: string
  // Whose the profile is, not only what kind it is (specs.md §10.20):
  // today two Google accounts on one device are indistinguishable, so
  // signing back in resolves by recency alone rather than identity.
  // Additive, optional — `undefined` for a `'local'` profile (there is no
  // account to key it by) and for every profile that predates this field
  // (none has ever shipped: `registerProfile` had no production caller
  // before this, so there is nothing to migrate). Set for a `'google'`
  // profile via `resolveGoogleProfile` below, keyed on the account's email
  // (`specs.md` §5: identity = the userinfo `email`, already fetched on
  // every session, not a second field to request).
  accountKey?: string
}

// Lives on src/lib/deviceStore.ts's shared `kurobello-device` connection
// (its `profiles` table), not a database of its own — the registry lists
// profiles, it never holds a profile's actual data (`db.ts`'s
// `createProfileDb()` builds each profile's real database). This originally
// shipped as its own `kurobello-profiles` database only because
// `deviceStore.ts` was another in-flight Wave 3 track's file this stage
// (docs/wave-3-plan.md §2's ownership map); folded in once that stopped
// being true, since neither had shipped yet (`specs.md` §11, 2026-08-19).
const profileTable = deviceDb.profiles

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
    return await profileTable.toArray()
  } catch (e) {
    console.warn('profiles: could not read the registry, treating as empty', e)
    return []
  }
}

export const getProfile = async (id: string): Promise<ProfileRecord | undefined> => {
  try {
    return await profileTable.get(id)
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
  accountKey?: string
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
  return deviceDb.transaction('rw', profileTable, async () => {
    const existing = await profileTable.toArray()
    const record: ProfileRecord = {
      ...input,
      createdAt: nowIso(),
      lastUsedAt: nextLastUsedAt(existing),
    }
    await profileTable.put(record)
    return record
  })
}

export const touchLastUsed = async (id: string): Promise<void> => {
  try {
    await deviceDb.transaction('rw', profileTable, async () => {
      const existing = await profileTable.toArray()
      await profileTable.update(id, { lastUsedAt: nextLastUsedAt(existing) })
    })
  } catch (e) {
    // Best-effort, same posture as deviceStore.ts's markLoggedIn: losing
    // this write just means recency-based active-profile selection is
    // slightly stale next read, not that anything already saved is lost.
    console.warn(`profiles: could not update last-used for "${id}"`, e)
  }
}

export interface ResolveGoogleProfileInput {
  accountKey: string
  label: string
}

// specs.md §10.20: what makes getActiveProfile()'s existing recency
// resolution identity-aware, without that function's own signature
// changing at all — whichever account resolves here becomes, by
// construction, the most-recently-touched profile, so signing back in
// naturally resolves to the right one. Matched by `accountKey`, never by
// `label`: a display name can repeat or change, an account's email doesn't.
// Deliberately not wrapped in a self-catching swallow, same posture as
// registerProfile above: a caller establishing a Google session needs to
// know if this didn't happen, not have it silently degrade. The label on
// an already-registered profile is intentionally left as first-registered
// — updating it to track a since-renamed Google account is a real feature
// (Wave 5+'s renaming), not a side effect of this resolution.
//
// The whole find-or-create runs inside one `rw` transaction on
// `profileTable`, same reasoning as `registerProfile`'s own comment: two
// concurrent calls for the same account (a login racing restore()/hydrate(),
// or two tabs restoring the same account at once) must not both read "no
// existing profile" before either writes and mint two rows for one account
// — a get-then-put race with the identical shape as the one already fixed
// for `lastUsedAt` ties. IndexedDB serializes `readwrite` transactions
// against the same object store, so the second call's read only starts once
// the first call's write has committed.
export const resolveGoogleProfile = async (
  input: ResolveGoogleProfileInput,
): Promise<ProfileRecord> => {
  return deviceDb.transaction('rw', profileTable, async () => {
    const existing: ProfileRecord[] = await profileTable.toArray()
    const owned = existing.find((p) => p.kind === 'google' && p.accountKey === input.accountKey)
    if (owned) {
      const touched: ProfileRecord = { ...owned, lastUsedAt: nextLastUsedAt(existing) }
      await profileTable.put(touched)
      return touched
    }
    const id = crypto.randomUUID()
    const record: ProfileRecord = {
      id,
      label: input.label,
      kind: 'google',
      databaseName: makeProfileDatabaseName(id),
      createdAt: nowIso(),
      lastUsedAt: nextLastUsedAt(existing),
      accountKey: input.accountKey,
    }
    await profileTable.put(record)
    return record
  })
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
      await profileTable.put(record)
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
// __resetReadyMemoForTests: `deviceDb` is a module singleton reused across a
// whole test file. Not exported from any public surface.
export const __clearRegistryForTests = async (): Promise<void> => {
  await profileTable.clear()
}
