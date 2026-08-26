import { db, type ProfileDb } from '@/lib/db'
import { clearAdoptionConsent, getAdoptionConsent } from '@/lib/deviceStore'
import { enqueueOperation } from '@/lib/outbox'
import { getProfileDatabase } from '@/lib/profiles/profileDb'
import type { ProfileRecord } from '@/lib/profiles/profileRegistry'

export const countGuestMovements = async (): Promise<number> => db.movimientos.count()

export interface AdoptionResult {
  movedCount: number
}

export const adoptGuestMovements = async (target: ProfileRecord): Promise<AdoptionResult> => {
  const movements = await db.movimientos.toArray()
  if (movements.length === 0) return { movedCount: 0 }

  const targetDb: ProfileDb = getProfileDatabase(target.databaseName)
  await targetDb.movimientos.bulkPut(movements)

  for (const mov of movements) {
    const alreadyQueued = await targetDb.outbox
      .where('[entity+entityId]')
      .equals(['movimiento', mov.id])
      .count()
    if (alreadyQueued > 0) continue
    const queued = await enqueueOperation(
      { entity: 'movimiento', op: 'put', payload: mov },
      targetDb,
    )
    if (!queued) throw new Error(`adoption: could not queue movement "${mov.id}" for Drive`)
  }

  await db.movimientos.bulkDelete(movements.map((m) => m.id))
  return { movedCount: movements.length }
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
