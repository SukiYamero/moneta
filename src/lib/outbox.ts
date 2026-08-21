import { create } from 'zustand'
import type { Config, Movimiento } from '@/lib/schema'
import { db, type ProfileDb } from '@/lib/db'
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
// `movimientos`/`config` on this connection rather than a shared one.
// Starts on the frozen default `db` (the `kurobello` profile) and is
// redirected by `setOutboxDatabase()` below, the boot sequence's one call
// (specs.md §10.25 addendum, §12 2026-08-19): once `dataStore.ts` writes
// through the profile-scoped repo, a guest's pending operations queuing
// into a signed-in account's outbox (or vice versa) is data crossing
// accounts, not a tidiness issue — this must move with the flip.
let entries = db.outbox

/**
 * Redirects every function below to the given profile's own `outbox`
 * table. Called once by the boot sequence right after
 * `repoProvider.bindActiveProfile()` (specs.md §10.28) — the outbox and the
 * repo must always point at the same profile, or a write lands in one
 * profile's database while its sync record queues under another's.
 */
export const setOutboxDatabase = (database: ProfileDb): void => {
  entries = database.outbox
  void refreshDirty()
}

const CONFIG_ENTITY_ID = 'config'

const entityIdOf = (operation: OutboxOperation): string =>
  operation.entity === 'config' ? CONFIG_ENTITY_ID : operation.payload.id

let clock: LogicalClock | null = null

// This module owns the one clock instance every local tick comes from, so
// it is also the one place that can fold in what a pull/push just taught it
// (hlc.ts's `observe`/`clampToServer` — the "hybrid" half of the clock).
// Lazily creating it here (not just in `nextHlc`) means `sync/engine.ts`
// can call `observeRemoteHlc`/`clampOutboxClockToServer` right after a pull,
// before this device has ever ticked locally, and have it actually stick.
const ensureClock = async (): Promise<LogicalClock> => {
  clock ??= createLogicalClock(await getDeviceId())
  return clock
}

const nextHlc = async (): Promise<{ hlc: Hlc; device: string }> => {
  const [c, device] = await Promise.all([ensureClock(), getDeviceId()])
  return { hlc: c.tick(), device }
}

/** Called by `sync/engine.ts` after a pull, once per downloaded op's hlc — so this device's next local tick sorts after everything it just learned, not just what it has ticked itself. */
export const observeRemoteHlc = async (remote: Hlc): Promise<void> => {
  const c = await ensureClock()
  c.observe(remote)
}

/** Called by `sync/engine.ts` whenever a Drive response carries a server `Date` (specs.md §10.19's clock-skew clamp). */
export const clampOutboxClockToServer = async (serverNowMs: number): Promise<void> => {
  const c = await ensureClock()
  c.clampToServer(serverNowMs)
}

/**
 * Resolves which outbox table a call should actually touch — the given
 * `database`'s own `outbox` table if one was passed, the module's current
 * redirect otherwise. specs.md §10.31 edge case: `sync/engine.ts`'s
 * `push()`/`pull()` span a Drive round trip, and a profile switch can
 * redirect `setOutboxDatabase()` mid-flight — reading the module-level
 * `entries` binding *after* that await resumes would then touch whatever
 * profile is newly active, not the profile the call was actually made for.
 * Every caller that already has its own `profile`/`database` in hand
 * (engine.ts) passes it explicitly and is immune to the redirect; every
 * other caller (bootstrap.ts, the sign-out confirm count) keeps reading
 * "whatever's currently active," which is what they mean.
 */
const tableFor = (database?: ProfileDb): typeof entries => database?.outbox ?? entries

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
const lastHlcFor = async (
  entity: string,
  entityId: string,
  database?: ProfileDb,
): Promise<Hlc | null> => {
  const table = tableFor(database)
  const [ownHistory, pulledTip] = await Promise.all([
    (async (): Promise<Hlc | null> => {
      try {
        const rows = await table.where('[entity+entityId]').equals([entity, entityId]).sortBy('hlc')
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
//
// `database` (specs.md §10.32): an optional target other than "whatever the
// module is currently redirected to" — the guest-data adoption path writes
// straight into a profile that isn't (yet, or ever) the active one, without
// waiting for `setOutboxDatabase()` to point at it first. Every existing
// caller (`dataStore.ts`, via the repo write path) omits it and keeps
// writing to the active profile exactly as before; only omitting it also
// updates `useOutboxStore`'s `dirty` flag, since that flag describes the
// *currently displayed* profile's pending state, not whichever database an
// out-of-band write happened to target.
export const enqueueOperation = async (
  operation: OutboxOperation,
  database?: ProfileDb,
): Promise<boolean> => {
  const table = tableFor(database)
  const entityId = entityIdOf(operation)
  try {
    const [basedOn, { hlc, device }] = await Promise.all([
      lastHlcFor(operation.entity, entityId, database),
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
    await table.add(entry)
    if (!database) useOutboxStore.setState({ dirty: true })
    return true
  } catch (e) {
    console.warn('outbox: could not enqueue operation, this device will not sync it', e)
    return false
  }
}

/**
 * In hlc order — the total order §10.19's replay rule needs.
 *
 * `database` (specs.md §10.31 edge case): `sync/engine.ts`'s `pull()`/
 * `push()` pass the pushing/pulling profile's own database explicitly,
 * rather than reading whatever the module is *currently* redirected to —
 * a Drive round trip is long enough for a profile switch to redirect
 * `setOutboxDatabase()` mid-flight, and a call already in progress for
 * profile A must keep reading profile A's own outbox regardless. Every
 * other caller (`bootstrap.ts`, the sign-out confirm count) omits it and
 * keeps reading "whichever profile is active right now," which is what
 * they mean.
 */
export const listPendingOperations = async (database?: ProfileDb): Promise<OutboxEntry[]> => {
  const table = tableFor(database)
  try {
    return await table.orderBy('hlc').toArray()
  } catch (e) {
    console.warn('outbox: could not read pending operations', e)
    return []
  }
}

/**
 * For a flush to acknowledge a successful push. `database` — same reasoning
 * as `listPendingOperations` above, and the actual fix for the traced bug
 * (specs.md §12, 2026-08-20): without it, a push already in flight for
 * profile A whose Drive round trip outlasts a switch to profile B would
 * call `bulkDelete` against B's table (via the module-level redirect),
 * silently no-op (A's ids don't exist there), and leave A's
 * already-uploaded ops stuck "pending" forever.
 */
export const removeOperations = async (ids: string[], database?: ProfileDb): Promise<void> => {
  const table = tableFor(database)
  try {
    await table.bulkDelete(ids)
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

// Test-only: points the module back at the frozen default `db`, so a test
// that redirected the outbox doesn't leak that binding into the next one.
export const __resetOutboxDatabaseForTests = (): void => {
  entries = db.outbox
}
