import { accountKeyOf, useAuthStore } from '@/lib/authStore'
import { useBootStore } from '@/lib/boot'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { startSyncSession, stopSyncSession } from '@/lib/sync/syncSession'
// Imported directly from their own modules, not the `@/lib/profiles` barrel
// — that barrel re-exports this very module, so importing through it here
// would be a self-referential cycle.
import { setActiveProfileId, type ProfileRecord } from '@/lib/profiles/profileRegistry'
import { getProfileDatabase } from '@/lib/profiles/profileDb'
import { readOwnerMarker } from '@/lib/profiles/profileOwner'

// switchProfile.ts — specs.md §10.31 §4's rebind, composed above boot.ts,
// authStore.ts and sync/syncSession.ts rather than inside any one of them.
// It has to live here, not in boot.ts itself: authStore.ts already imports
// `invalidateBootForSignOut` from boot.ts, and syncSession.ts already
// imports authStore.ts — boot.ts importing syncSession.ts directly would
// close that into a cycle (boot → syncSession → authStore → boot). This
// module sits one layer above all three, importing each of them without
// being imported back by any.

export type SwitchProfileResult =
  | { outcome: 'noop' }
  | { outcome: 'switched' }
  | { outcome: 'profile-database-gone' }

/**
 * Switches the active profile (specs.md §10.31): no PIN (decided by the
 * user — the PIN gates opening the app, not moving inside it, §10.31 §3),
 * no new rebind path (`boot.ts`'s `run()` is reused exactly as sign-out +
 * sign-in-as-a-different-account already reuses it), and sync follows the
 * switch rather than staying wherever it was left.
 *
 * Order: pre-check the target database is actually there → set the
 * explicit pointer → rebind (resolve, bind the repo, redirect the outbox,
 * reset+reload the data store — all `boot.ts`'s own) → stop the old
 * profile's sync triggers → start the new one's, only if that profile's
 * account matches the one currently authenticated (§10.31 §4: switching to
 * a Google profile you are not signed into shows its local data with sync
 * off, on purpose).
 */
export const switchToProfile = async (target: ProfileRecord): Promise<SwitchProfileResult> => {
  const current = getActiveProfileBinding()
  if (current?.profile.id === target.id) return { outcome: 'noop' }

  // specs.md §10.31 edge case: "the registry lists a profile whose database
  // is gone (cleared storage) — must say so and offer removal, never fail
  // opaquely." `repoProvider.ts`'s `resolveActiveProfileBinding()` ensures
  // this marker on every bind, so any profile that has ever actually been
  // bound before (every profile reachable through the switcher today —
  // registering one is always immediately followed by binding it, at
  // sign-in) already carries it; its absence here means the database's
  // storage was cleared out from under the registry.
  const targetDatabase = getProfileDatabase(target.databaseName)
  const marker = await readOwnerMarker(targetDatabase)
  if (!marker) return { outcome: 'profile-database-gone' }

  await setActiveProfileId(target.id)
  await useBootStore.getState().run()

  // Stop unconditionally first — the old profile's triggers must never keep
  // running once its data is no longer what's on screen, whether or not
  // the new one gets its own.
  stopSyncSession()
  const rebound = getActiveProfileBinding()
  const { status, drive, user } = useAuthStore.getState()
  const eligible =
    status === 'authenticated' &&
    drive !== null &&
    rebound !== null &&
    rebound.profile.accountKey === accountKeyOf(user)
  if (eligible) startSyncSession()

  return { outcome: 'switched' }
}
