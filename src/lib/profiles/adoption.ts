import { db, type ProfileDb } from '@/lib/db'
import {
  clearAdoptionConsent,
  getAdoptedMovementIds,
  getAdoptionConsent,
  markMovementAdopted,
} from '@/lib/deviceStore'
import { enqueueOperation } from '@/lib/outbox'
import { getProfileDatabase } from '@/lib/profiles/profileDb'
import type { ProfileRecord } from '@/lib/profiles/profileRegistry'

export const countUnadoptedGuestMovements = async (targetDb: ProfileDb): Promise<number> => {
  const [guestIds, targetIds] = await Promise.all([
    db.movimientos.toCollection().primaryKeys(),
    targetDb.movimientos.toCollection().primaryKeys(),
  ])
  const targetIdSet = new Set(targetIds)
  return guestIds.filter((id) => !targetIdSet.has(id)).length
}

export interface AdoptionResult {
  adoptedCount: number
}

export const adoptGuestMovements = async (target: ProfileRecord): Promise<AdoptionResult> => {
  const targetDb: ProfileDb = getProfileDatabase(target.databaseName)
  const guestMovements = await db.movimientos.toArray()
  if (guestMovements.length === 0) return { adoptedCount: 0 }

  const targetIds = await targetDb.movimientos.toCollection().primaryKeys()
  const targetIdSet = new Set(targetIds)
  const toCopy = guestMovements.filter((m) => !targetIdSet.has(m.id))
  if (toCopy.length > 0) await targetDb.movimientos.bulkPut(toCopy)

  const alreadyAdopted = await getAdoptedMovementIds(
    target.id,
    guestMovements.map((m) => m.id),
  )

  let adoptedCount = 0
  for (const mov of guestMovements) {
    if (alreadyAdopted.has(mov.id)) continue
    const queued = await enqueueOperation(
      { entity: 'movimiento', op: 'put', payload: mov },
      targetDb,
    )
    if (!queued) throw new Error(`adoption: could not queue movement "${mov.id}" for Drive`)
    await markMovementAdopted(target.id, mov.id)
    adoptedCount += 1
  }

  return { adoptedCount }
}

export const finishConsentedAdoption = async (target: ProfileRecord): Promise<AdoptionResult> => {
  const result = await adoptGuestMovements(target)
  await clearAdoptionConsent()
  return result
}

export const resumePendingAdoption = async (activeProfile: ProfileRecord | null): Promise<void> => {
  const consent = await getAdoptionConsent()
  if (!consent) return
  if (
    !activeProfile ||
    activeProfile.id !== consent.profileId ||
    activeProfile.accountKey !== consent.accountKey
  ) {
    console.info(
      'adoption: a pending consent names a different profile than the one now active — leaving it in place',
    )
    return
  }
  try {
    await finishConsentedAdoption(activeProfile)
  } catch (e) {
    console.warn('adoption: could not resume an interrupted adoption, will retry on next boot', e)
  }
}
