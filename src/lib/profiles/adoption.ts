import { db, type ProfileDb } from '@/lib/db'
import { enqueueOperation } from '@/lib/outbox'
import { getProfileDatabase } from '@/lib/profiles/profileDb'
import type { ProfileRecord } from '@/lib/profiles/profileRegistry'

// adoption.ts — specs.md §10.32: bringing a guest's local movements into
// the account they just signed into. Movements only (the spec's own
// wording throughout is "N movements," and there is no sync write path for
// `Activo` yet — `outbox.ts`'s `OutboxOperation` union has no variant for
// it, so there is nothing to enqueue even if it were copied).
//
// The guest/local profile is always `db` (`db.ts`'s frozen `kurobello`
// instance) — a guest never has any other database (specs.md §10.15).

/**
 * "How much" — a real count, not a guess, for the prompt to name. Also
 * what gates the prompt existing at all: "nothing local to bring → no
 * prompt," the overwhelmingly common first sign-in.
 */
export const countGuestMovements = async (): Promise<number> => {
  try {
    return await db.movimientos.count()
  } catch (e) {
    console.warn('adoption: could not count local guest movements, treating as none', e)
    return 0
  }
}

export interface AdoptionResult {
  movedCount: number
}

/**
 * Moves every movement currently in the local/guest profile into `target`'s
 * own database and outbox — a merge, never a replace (specs.md §10.32):
 * movement ids are `crypto.randomUUID()`, so nothing already in `target`
 * can collide with what's moved in.
 *
 * **Resumable by construction, not by tracking progress.** Every step below
 * is expressed as an idempotent "set" operation over data re-read fresh on
 * each call — `bulkPut` into the target (overwriting with the same values
 * is a no-op), a guarded enqueue (skips an entity id already queued in the
 * target's outbox), then `bulkDelete` from the source. IndexedDB has no
 * primitive for a transaction spanning two separate databases, so this
 * can't be one atomic unit — but because every step is safe to redo, a
 * caller can retry this function after *any* interruption (a tab closed
 * mid-move) by simply calling it again with no special "resume" argument:
 * whatever's still in the guest profile is, by definition, what's left to
 * finish. `docs/error-handling.md`: this throws on failure (never resolves
 * "moved" for a partial success) — the caller decides whether/when to
 * retry, this module never swallows a failure into a silent no-op.
 */
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
