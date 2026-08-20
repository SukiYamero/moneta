// status.ts — pure derivation of every sync question a UI could ask, from
// the watermark (specs.md §10.19) instead of a stored isSynced flag that
// could disagree with reality. No stores, no Drive, no repo — this is the
// projection table, testable with plain objects.

export interface SyncWatermark {
  driveFolderId?: string
  lastPushAt?: string
  lastPullAt?: string
}

/** "My data lives in Drive" — a Drive binding, not `kind === 'google'` (specs.md §5: incremental authorization means sign-in and Drive access are separate consents). */
export const isLinkedToDrive = (profile: SyncWatermark): boolean =>
  profile.driveFolderId !== undefined

/** Gates the first-run download view (a later track): true once a pull has ever succeeded, false for a brand-new profile with only local data. */
export const hasEverSynced = (profile: SyncWatermark): boolean => profile.lastPullAt !== undefined

/** "Is anything pending" is the outbox's own `dirty` flag — not derived here, since this module has no outbox dependency; callers combine it directly. */
export type SyncIndicator = 'syncing' | 'up_to_date' | 'pending'

/**
 * The three-state indicator specs.md §10.19's UI section describes
 * (syncing · up to date · pending) — a pure projection over the engine's
 * in-flight phase and the outbox's dirty flag, never a fourth stored value.
 */
export const deriveSyncIndicator = (opts: {
  isSyncing: boolean
  outboxDirty: boolean
}): SyncIndicator => {
  if (opts.isSyncing) return 'syncing'
  if (opts.outboxDirty) return 'pending'
  return 'up_to_date'
}
