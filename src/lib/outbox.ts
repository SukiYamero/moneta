import { create } from 'zustand'
import type { Config, Movimiento } from '@/lib/schema'
import { db } from '@/lib/db'
import { getDeviceId } from '@/lib/deviceStore'
import { createLogicalClock, type Hlc, type LogicalClock } from '@/lib/hlc'
import { getKnownTip } from '@/lib/sync/tip'

// outbox.ts — the local record of operations not yet pushed to Drive
// (specs.md §10.13/§10.19). Track Z's sync engine is its first reader (the
// same way toastStore.ts shipped a wave before its first caller) and also
// its first fix: `basedOn` now consults `sync/tip.ts`'s cache of what the
// last pull taught this device, not just this device's own queued history
// — see `lastHlcFor`'s comment below for the concrete bug that closes.
//
// Activo mutations aren't built this wave (specs.md §10.13's scope is
// Movimiento CRUD + Config), so this union only covers what actually
// produces an operation today; a future Activo write path adds its own
// variants here rather than inventing a second outbox.
export type OutboxOperation =
  | { entity: 'movimiento'; op: 'put'; payload: Movimiento }
  | { entity: 'movimiento'; op: 'del'; payload: { id: string } }
  | { entity: 'config'; op: 'put'; payload: Config }

export interface OutboxEntry {
  id: string
  entity: OutboxOperation['entity']
  entityId: string
  hlc: Hlc
  basedOn: Hlc | null
  device: string
  enqueuedAt: number
  operation: OutboxOperation
}

// A table on the per-profile `ProfileDb` (`db.ts`'s `outbox` table, added
// in its v3), not a database of its own: the queue is per-profile data —
// each profile's own pending operations — the same reasoning that keeps
// `movimientos`/`config` on this connection rather than a shared one. Reads
// through the frozen default `db` (the `kurobello` profile) for now, matching
// `repoProvider.getRepo()`'s own current single-profile reality — the day
// `dataStore.ts` writes through `getActiveProfileRepo()` instead, this must
// move with it (see specs.md §12).
const entries = db.outbox

const CONFIG_ENTITY_ID = 'config'

const entityIdOf = (operation: OutboxOperation): string =>
  operation.entity === 'config' ? CONFIG_ENTITY_ID : operation.payload.id

let clock: LogicalClock | null = null

const nextHlc = async (): Promise<{ hlc: Hlc; device: string }> => {
  const device = await getDeviceId()
  clock ??= createLogicalClock(device)
  return { hlc: clock.tick(), device }
}

// basedOn is the best hlc this device knows for the entity: the greater of
// (a) the last op *this device's own outbox* recorded for it, and (b) the
// last hlc `sync/tip.ts` learned from a pull (or from a just-pushed op —
// engine.ts records one there the moment it clears the outbox row, so this
// device doesn't "forget" its own tip the instant a push drains it). (a)
// alone is what this function used to be, and it is wrong the moment a pull
// exists: device A creates a movement, pulls device B's edit (never queued
// in A's own outbox — it arrived via replay), then deletes it locally. If
// basedOn only consulted (a), the delete would be stamped with the
// *create's* hlc instead of B's edit's, making it look concurrent with an
// edit A actually saw — and opLog.ts's delete-vs-edit revival rule (correct
// for a genuine conflict) would fire on a case that was never one, silently
// un-deleting something the user just removed. hlc strings compare
// correctly as plain strings (hlc.ts), so "the greater of two" is just `>`.
const lastHlcFor = async (entity: string, entityId: string): Promise<Hlc | null> => {
  const [ownHistory, pulledTip] = await Promise.all([
    (async (): Promise<Hlc | null> => {
      try {
        const rows = await entries
          .where('[entity+entityId]')
          .equals([entity, entityId])
          .sortBy('hlc')
        return rows.at(-1)?.hlc ?? null
      } catch (e) {
        console.warn('outbox: could not read prior operations for basedOn, treating as unseen', e)
        return null
      }
    })(),
    getKnownTip(entity, entityId),
  ])
  if (!ownHistory) return pulledTip
  if (!pulledTip) return ownHistory
  return ownHistory > pulledTip ? ownHistory : pulledTip
}

interface OutboxState {
  dirty: boolean
}

// What a future flush trigger (reconnect, foreground, a debounce, pagehide
// — specs.md §10.19 "When it syncs") reads to decide whether there's
// anything to push, without re-querying dexie on every check.
export const useOutboxStore = create<OutboxState>(() => ({ dirty: false }))

const refreshDirty = async (): Promise<void> => {
  try {
    const count = await entries.count()
    useOutboxStore.setState({ dirty: count > 0 })
  } catch (e) {
    console.warn('outbox: could not read the pending count', e)
  }
}

// A returning session may already have pending entries from before this
// feature had any consumer to drain them — reflect that in `dirty` instead
// of defaulting to false and hiding a real backlog.
void refreshDirty()

// Appends one operation to the queue, stamping the envelope (hlc, basedOn,
// device) itself so every caller produces an identically-shaped entry.
// Self-catching like every other device-local write in this codebase
// (deviceStore.ts, networkStore.ts's anchor) — it never throws, so a
// queueing failure can never roll back the caller's repo write, which by
// the time this runs has already succeeded and is already what the user
// sees. But unlike those low-stakes device-signal writes, a dropped op here
// is not benign: it is the one and only record that this change needs to
// reach Drive, and nothing else will ever re-derive it. Returning `false`
// (never a bare `Promise<void>` — docs/error-handling.md §4, "never return
// a success-shaped value for a failure") lets the caller decide what a
// permanently-unsynced write means to the user, instead of that failure
// living only in a console a user never opens.
export const enqueueOperation = async (operation: OutboxOperation): Promise<boolean> => {
  const entityId = entityIdOf(operation)
  try {
    const [basedOn, { hlc, device }] = await Promise.all([
      lastHlcFor(operation.entity, entityId),
      nextHlc(),
    ])
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      entity: operation.entity,
      entityId,
      hlc,
      basedOn,
      device,
      enqueuedAt: Date.now(),
      operation,
    }
    await entries.add(entry)
    useOutboxStore.setState({ dirty: true })
    return true
  } catch (e) {
    console.warn('outbox: could not enqueue operation, this device will not sync it', e)
    return false
  }
}

/** In hlc order — the total order §10.19's replay rule needs. */
export const listPendingOperations = async (): Promise<OutboxEntry[]> => {
  try {
    return await entries.orderBy('hlc').toArray()
  } catch (e) {
    console.warn('outbox: could not read pending operations', e)
    return []
  }
}

/** For a future flush to acknowledge a successful push. Not called by anything yet. */
export const removeOperations = async (ids: string[]): Promise<void> => {
  try {
    await entries.bulkDelete(ids)
  } catch (e) {
    console.warn('outbox: could not clear pushed operations, they will be retried', e)
    return
  }
  await refreshDirty()
}

// Test-only: forces a fresh clock (and device id) on the next enqueue,
// matching deviceStore.ts's __resetDeviceIdForTests.
export const __resetOutboxClockForTests = (): void => {
  clock = null
}
