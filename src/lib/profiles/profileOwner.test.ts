import { afterEach, expect, test, vi } from 'vitest'
import { db } from '@/lib/db'
import { ensureOwnerMarker, readOwnerMarker } from '@/lib/profiles/profileOwner'

afterEach(async () => {
  await db.profileOwner.clear()
})

test('ensureOwnerMarker writes a marker on an unmarked database', async () => {
  await ensureOwnerMarker(db, { kind: 'local', createdAt: '2026-08-20T00:00:00.000Z' })
  expect(await readOwnerMarker(db)).toEqual({
    id: 1,
    kind: 'local',
    accountKey: undefined,
    createdAt: '2026-08-20T00:00:00.000Z',
  })
})

test('ensureOwnerMarker is idempotent: a second call never overwrites the first marker', async () => {
  await ensureOwnerMarker(db, { kind: 'google', accountKey: 'ana@example.com', createdAt: 'T1' })
  await ensureOwnerMarker(db, { kind: 'google', accountKey: 'beto@example.com', createdAt: 'T2' })

  expect((await readOwnerMarker(db))?.accountKey).toBe('ana@example.com')
})

test('readOwnerMarker returns undefined on a database that was never marked', async () => {
  expect(await readOwnerMarker(db)).toBeUndefined()
})

test('ensureOwnerMarker degrades to a warning, never throws, on a storage failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(db.profileOwner, 'put').mockRejectedValue(new Error('IDB blocked'))

  await expect(ensureOwnerMarker(db, { kind: 'local', createdAt: 'T1' })).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

// A genuinely absent marker lets the switcher offer an irreversible registry
// removal, so a transient read failure must never be degraded to `undefined`.
test('readOwnerMarker propagates a storage failure instead of degrading it to "absent"', async () => {
  const spy = vi.spyOn(db.profileOwner, 'get').mockRejectedValue(new Error('IDB blocked'))

  await expect(readOwnerMarker(db)).rejects.toThrow('IDB blocked')

  spy.mockRestore()
})
