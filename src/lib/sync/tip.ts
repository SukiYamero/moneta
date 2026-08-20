import type { Hlc } from '@/lib/hlc'
import { deviceDb } from '@/lib/deviceStore'

// tip.ts — "the last hlc this device knows about, per entity," kept
// current by every successful pull and every successful push
// (`sync/engine.ts`). `outbox.ts`'s own comment flagged the gap this
// closes: its `basedOn` approximation used to be "the last op *this
// device's own outbox* recorded for this entity," which is correct only
// until a pull teaches the device about a newer version it never queued
// itself. Concretely (traced, specs.md §11 2026-08-19): device A creates a
// movement, pulls and sees device B's edit, then deletes it locally — if
// A's own outbox history is all `basedOn` consults, the delete is stamped
// `basedOn: <the original create>` instead of `basedOn: <B's edit>`, making
// it look concurrent with an edit it actually saw, which falsely revives it
// on the next merge (opLog.ts's documented, *intentional* revival rule
// firing on a case it was never meant to cover).
//
// Device-scoped, not per-profile: this is a transport-layer cache (what the
// last pull merged), not app data — `schema.ts`/the profile's own dexie
// tables are never touched by it, matching specs.md §10.19 exactly ("no
// updatedAt, no deletedAt on Movimiento"). Not scoped by profile id either,
// mirroring `outbox.ts`'s own current single-profile posture (`getRepo()`
// isn't profile-aware yet) — move both together the day that changes
// (outbox.ts's own comment already flags this same debt).

const tips = deviceDb.syncTips

const keyFor = (entity: string, entityId: string): string => `${entity}:${entityId}`

/** Called after a successful pull (per merged id) and after a successful push (per just-uploaded op) — see sync/engine.ts. Never moves a tip backward: an out-of-order caller recording a smaller hlc is a no-op. */
export const recordKnownTip = async (entity: string, entityId: string, hlc: Hlc): Promise<void> => {
  try {
    const key = keyFor(entity, entityId)
    const existing = await tips.get(key)
    if (existing && existing.hlc >= hlc) return
    await tips.put({ id: key, hlc })
  } catch (e) {
    // Best-effort, same posture as every other device signal
    // (deviceStore.ts): losing this write only means a future basedOn falls
    // back to the outbox-only approximation for this one entity, not that
    // anything already merged is lost.
    console.warn(`sync: could not record the known tip for ${entity}:${entityId}`, e)
  }
}

export const getKnownTip = async (entity: string, entityId: string): Promise<Hlc | null> => {
  try {
    return (await tips.get(keyFor(entity, entityId)))?.hlc ?? null
  } catch (e) {
    console.warn(
      `sync: could not read the known tip for ${entity}:${entityId}, treating as unknown`,
      e,
    )
    return null
  }
}

// Test-only: matches deviceStore.ts's own __resetDeviceIdForTests posture.
export const __clearKnownTipsForTests = async (): Promise<void> => {
  await tips.clear()
}
