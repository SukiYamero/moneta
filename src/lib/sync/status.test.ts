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
  it.each([
    // isSyncing, outboxDirty, lastError, expected
    [true, true, 'boom', 'syncing'],
    [true, true, null, 'syncing'],
    [true, false, 'boom', 'syncing'],
    [true, false, null, 'syncing'],
    [false, true, 'boom', 'error'],
    [false, false, 'boom', 'error'],
    [false, true, null, 'pending'],
    [false, false, null, 'up_to_date'],
  ] as const)(
    'isSyncing=%s outboxDirty=%s lastError=%s -> %s',
    (isSyncing, outboxDirty, lastError, expected) => {
      expect(deriveSyncIndicator({ isSyncing, outboxDirty, lastError })).toBe(expected)
    },
  )

  it('a pull failure with a clean outbox reads as an error, never "up to date"', () => {
    expect(
      deriveSyncIndicator({ isSyncing: false, outboxDirty: false, lastError: 'some error' }),
    ).toBe('error')
  })
})
