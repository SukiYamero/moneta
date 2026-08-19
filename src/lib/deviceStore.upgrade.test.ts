import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

// Deliberately does NOT statically import '@/lib/deviceStore' — that module
// opens the real `kurobello-device` connection and upgrades it to v2 as a
// side effect of being imported, which would make it impossible to seed a
// v1-only database first. Kept in its own file so this is the only test
// touching this database's version history; deviceStore.test.ts's own
// top-level import already owns opening it at v2 for every other test.
//
// Verifies the claim in docs/wave-2/track-j.md directly (an orphaned login
// marker would silently force a re-login for every existing user) instead
// of assuming Dexie's additive-version pattern is safe just because it
// mirrors db.ts's own (docs/error-handling.md §8: test the upgrade path).
type MarkerRow = { id: number; loggedInBefore: boolean }

beforeEach(async () => {
  const v1 = new Dexie('kurobello-device') as Dexie & { marker: EntityTable<MarkerRow, 'id'> }
  v1.version(1).stores({ marker: 'id' })
  await v1.open()
  await v1.marker.put({ id: 1, loggedInBefore: true })
  v1.close()
})

afterEach(async () => {
  await Dexie.delete('kurobello-device')
})

test('an existing v1 device upgrades to v2 without losing its login marker', async () => {
  const { getDriveDecision, hasLoggedInBefore } = await import('@/lib/deviceStore')

  expect(await hasLoggedInBefore()).toBe(true)
  // A device that never saw the Drive prompt before this track shipped must
  // resolve to "unanswered," not crash or silently fabricate a decision.
  expect(await getDriveDecision()).toBeUndefined()
})
