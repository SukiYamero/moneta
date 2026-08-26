import type { ProfileOwnerRow } from '@/lib/db'
import { accountKeyOf, useAuthStore } from '@/lib/authStore'
import { useBootStore } from '@/lib/boot'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { startSyncSession, stopSyncSession } from '@/lib/sync/syncSession'
import { setActiveProfileId, type ProfileRecord } from '@/lib/profiles/profileRegistry'
import { getProfileDatabase } from '@/lib/profiles/profileDb'
import { readOwnerMarker } from '@/lib/profiles/profileOwner'

export type SwitchProfileResult =
  | { outcome: 'noop' }
  | { outcome: 'switched' }
  | { outcome: 'profile-database-gone' }
  | { outcome: 'switch-failed' }
  | { outcome: 'switch-check-failed' }

export const switchToProfile = async (target: ProfileRecord): Promise<SwitchProfileResult> => {
  const current = getActiveProfileBinding()
  if (current?.profile.id === target.id) return { outcome: 'noop' }

  const targetDatabase = getProfileDatabase(target.databaseName)
  let marker: ProfileOwnerRow | undefined
  try {
    marker = await readOwnerMarker(targetDatabase)
  } catch (e) {
    console.warn('profiles: could not verify the target profile before switching', e)
    return { outcome: 'switch-check-failed' }
  }
  if (!marker) return { outcome: 'profile-database-gone' }

  await setActiveProfileId(target.id)
  await useBootStore.getState().run()

  const rebound = getActiveProfileBinding()
  if (rebound?.profile.id !== target.id) {
    if (current) {
      await setActiveProfileId(current.profile.id)
      await useBootStore.getState().run()
    }
    return { outcome: 'switch-failed' }
  }

  stopSyncSession()
  const { status, drive, user } = useAuthStore.getState()
  const eligible =
    status === 'authenticated' &&
    drive !== null &&
    rebound.profile.accountKey === accountKeyOf(user)
  if (eligible) startSyncSession()

  return { outcome: 'switched' }
}
