import Dexie, { type EntityTable } from 'dexie'
import { create } from 'zustand'
import type { Config, Movimiento } from '@/lib/schema'
import { getDeviceId } from '@/lib/deviceStore'
import { createLogicalClock, type Hlc, type LogicalClock } from '@/lib/hlc'

// outbox.ts — the local record of operations not yet pushed to Drive
// (specs.md §10.13/§10.19). Nothing consumes it yet: Track Z's sync engine
// is the first reader, the same way toastStore.ts shipped a wave before its
// first caller. What's built here is the op envelope (hlc/basedOn/device),
// the queue itself, and the `dirty` signal a future flush trigger reads —
// not transport, not file sharding, not merge.
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

type OutboxDb = Dexie & { entries: EntityTable<OutboxEntry, 'id'> }

// A dedicated database, not a table on the per-profile ProfileDb
// (`db.ts`, `specs.md` §10.15): the outbox is sync bookkeeping, not domain
// data, and this track's blast radius doesn't touch `db.ts`. One outbox for
// the whole device for now — `repoProvider.getRepo()` still serves a single
// active repo (profile-scoped writes aren't wired yet), so there's exactly
// one thing to queue for; see this track's report for the follow-up once
// that changes.
export const outboxDb = new Dexie('kurobello-outbox') as OutboxDb
outboxDb.version(1).stores({ entries: 'id, hlc, [entity+entityId]' })

const CONFIG_ENTITY_ID = 'config'

const entityIdOf = (operation: OutboxOperation): string =>
  operation.entity === 'config' ? CONFIG_ENTITY_ID : operation.payload.id

let clock: LogicalClock | null = null

const nextHlc = async (): Promise<{ hlc: Hlc; device: string }> => {
  const device = await getDeviceId()
  clock ??= createLogicalClock(device)
  return { hlc: clock.tick(), device }
}

// basedOn is the hlc of the last operation *this device* recorded for the
// same entity — the local approximation available before a sync engine
// exists. Once Track Z's pull/replay lands, the real "last known hlc" for
// an entity should come from the merged log (including other devices'
// ops), not just this device's own outbox history; that's a finding for
// whoever builds it, not something fakeable here without a merge to read.
const lastHlcFor = async (entity: string, entityId: string): Promise<Hlc | null> => {
  try {
    const rows = await outboxDb.entries
      .where('[entity+entityId]')
      .equals([entity, entityId])
      .sortBy('hlc')
    return rows.at(-1)?.hlc ?? null
  } catch (e) {
    console.warn('outbox: could not read prior operations for basedOn, treating as unseen', e)
    return null
  }
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
    const count = await outboxDb.entries.count()
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
// Best-effort and self-catching, matching every other device-local write in
// this codebase (deviceStore.ts, networkStore.ts's anchor): by the time
// this runs, the caller's repo write has already succeeded and the user has
// already seen the result — a queueing failure here can only ever cost a
// future sync, never the local data itself (this track's repo-vs-outbox
// ordering decision; see docs/wave-3/t.md).
export const enqueueOperation = async (operation: OutboxOperation): Promise<void> => {
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
    await outboxDb.entries.add(entry)
    useOutboxStore.setState({ dirty: true })
  } catch (e) {
    console.warn('outbox: could not enqueue operation, this device will not sync it', e)
  }
}

/** In hlc order — the total order §10.19's replay rule needs. */
export const listPendingOperations = async (): Promise<OutboxEntry[]> => {
  try {
    return await outboxDb.entries.orderBy('hlc').toArray()
  } catch (e) {
    console.warn('outbox: could not read pending operations', e)
    return []
  }
}

/** For a future flush to acknowledge a successful push. Not called by anything yet. */
export const removeOperations = async (ids: string[]): Promise<void> => {
  try {
    await outboxDb.entries.bulkDelete(ids)
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
