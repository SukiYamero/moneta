export interface SyncWatermark {
  driveFolderId?: string
  lastPushAt?: string
  lastPullAt?: string
}

export const isLinkedToDrive = (profile: SyncWatermark): boolean =>
  profile.driveFolderId !== undefined

export const hasEverSynced = (profile: SyncWatermark): boolean => profile.lastPullAt !== undefined

export type SyncIndicator = 'syncing' | 'up_to_date' | 'pending'

export const deriveSyncIndicator = (opts: {
  isSyncing: boolean
  outboxDirty: boolean
}): SyncIndicator => {
  if (opts.isSyncing) return 'syncing'
  if (opts.outboxDirty) return 'pending'
  return 'up_to_date'
}
