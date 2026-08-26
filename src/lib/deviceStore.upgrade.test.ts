import Dexie, { type EntityTable } from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'

// Deliberately does NOT statically import '@/lib/deviceStore' — that module
// opens the real `kurobello-device` connection and upgrades it to v2 as a
// side effect of being imported, which would make it impossible to seed a
// v1-only database first; an orphaned marker would otherwise silently force a re-login for every existing user.
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
  // A device that never saw the Drive prompt resolves to "unanswered," not
  // a crash or a fabricated decision.
  expect(await getDriveDecision()).toBeUndefined()
})
