import type { ProfileDb, ProfileOwnerRow } from '@/lib/db'

// specs.md §10.31 §2: the owner marker written inside each profile's own
// database. Deliberately its own module, not folded into `profileDb.ts` or
// `profileRegistry.ts` — it only imports `@/lib/db`'s types, so neither of
// those two (which already import each other's exports — `profileDb.ts`
// reads `profileRegistry.ts`'s `DEFAULT_PROFILE_DATABASE_NAME` at its own
// module top level) risks a value-level import cycle by also depending on
// this one.
const OWNER_ROW_ID = 1 as const

/**
 * Writes the marker only if the database doesn't already carry one —
 * idempotent, safe to call on every bind (`repoProvider.ts`'s
 * `resolveActiveProfileBinding()`). Self-catching: a storage failure here
 * must never block a boot or a switch over a few bytes of provenance.
 */
export const ensureOwnerMarker = async (
  database: ProfileDb,
  marker: Omit<ProfileOwnerRow, 'id'>,
): Promise<void> => {
  try {
    const existing = await database.profileOwner.get(OWNER_ROW_ID)
    if (existing) return
    await database.profileOwner.put({ id: OWNER_ROW_ID, ...marker })
  } catch (e) {
    console.warn('profiles: could not write the owner marker', e)
  }
}

/**
 * `undefined` means only "never marked" (a database created before this
 * feature shipped, or genuinely never bound) — the switcher (`switchProfile.ts`)
 * turns that into "this profile's database looks gone" and offers an
 * irreversible registry removal. Deliberately does not self-catch
 * (docs/error-handling.md §4): a storage read failure is not the same fact
 * as a genuinely absent row, and conflating the two would make that removal
 * reachable on a transient IndexedDB failure (Safari eviction, a blocked
 * version change, quota pressure) rather than an actually-cleared database.
 * The caller decides how to degrade a thrown failure; this function only
 * ever promises "absent" when the row is actually absent.
 */
export const readOwnerMarker = async (
  database: ProfileDb,
): Promise<ProfileOwnerRow | undefined> => {
  return await database.profileOwner.get(OWNER_ROW_ID)
}
