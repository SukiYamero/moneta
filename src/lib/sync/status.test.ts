import { describe, expect, it } from 'vitest'
import { deriveSyncIndicator, hasEverSynced, isLinkedToDrive } from '@/lib/sync/status'

describe('isLinkedToDrive', () => {
  it('is true only once a driveFolderId is recorded', () => {
    expect(isLinkedToDrive({})).toBe(false)
    expect(isLinkedToDrive({ driveFolderId: 'FOLD' })).toBe(true)
  })
})

describe('hasEverSynced', () => {
  it('is true only once a pull has ever succeeded', () => {
    expect(hasEverSynced({})).toBe(false)
    expect(hasEverSynced({ lastPullAt: '2026-08-19T00:00:00.000Z' })).toBe(true)
  })
})

describe('deriveSyncIndicator', () => {
  it('syncing wins over everything else', () => {
    expect(deriveSyncIndicator({ isSyncing: true, outboxDirty: true })).toBe('syncing')
    expect(deriveSyncIndicator({ isSyncing: true, outboxDirty: false })).toBe('syncing')
  })

  it('pending when not syncing but the outbox has unpushed writes', () => {
    expect(deriveSyncIndicator({ isSyncing: false, outboxDirty: true })).toBe('pending')
  })

  it('up to date when idle and nothing pending', () => {
    expect(deriveSyncIndicator({ isSyncing: false, outboxDirty: false })).toBe('up_to_date')
  })
})
