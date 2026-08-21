import { afterEach, expect, test, vi } from 'vitest'
import {
  __resetDeviceIdForTests,
  clearDriveDecision,
  clearGuestLock,
  clearLoggedIn,
  deviceDb,
  getDeviceId,
  getDriveDecision,
  getGuestLock,
  hasLoggedInBefore,
  markLoggedIn,
  setDriveDecision,
  setGuestLock,
  touchGuestLockActive,
} from '@/lib/deviceStore'

afterEach(async () => {
  await clearLoggedIn()
  await clearDriveDecision()
  await clearGuestLock()
  await deviceDb.deviceId.clear()
  __resetDeviceIdForTests()
})

test('no marker on a fresh device', async () => {
  expect(await hasLoggedInBefore()).toBe(false)
})

test('markLoggedIn sets the marker', async () => {
  await markLoggedIn()
  expect(await hasLoggedInBefore()).toBe(true)
})

test('clearLoggedIn removes the marker', async () => {
  await markLoggedIn()
  await clearLoggedIn()
  expect(await hasLoggedInBefore()).toBe(false)
})

test('clearLoggedIn on an already-clear marker is a no-op, not an error', async () => {
  await expect(clearLoggedIn()).resolves.toBeUndefined()
  expect(await hasLoggedInBefore()).toBe(false)
})

test('no Drive decision on a fresh device', async () => {
  expect(await getDriveDecision()).toBeUndefined()
})

test('setDriveDecision persists connected', async () => {
  await setDriveDecision('connected')
  expect(await getDriveDecision()).toBe('connected')
})

test('setDriveDecision persists dismissed', async () => {
  await setDriveDecision('dismissed')
  expect(await getDriveDecision()).toBe('dismissed')
})

test('setDriveDecision overwrites a previous decision', async () => {
  await setDriveDecision('dismissed')
  await setDriveDecision('connected')
  expect(await getDriveDecision()).toBe('connected')
})

test('clearDriveDecision removes the decision', async () => {
  await setDriveDecision('connected')
  await clearDriveDecision()
  expect(await getDriveDecision()).toBeUndefined()
})

test('clearDriveDecision on an already-clear decision is a no-op, not an error', async () => {
  await expect(clearDriveDecision()).resolves.toBeUndefined()
  expect(await getDriveDecision()).toBeUndefined()
})

test('the login marker and the Drive decision are independent', async () => {
  await markLoggedIn()
  await setDriveDecision('dismissed')

  await clearDriveDecision()

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await getDriveDecision()).toBeUndefined()
})

// docs/error-handling.md §8: every swallow needs a test proving the failure
// path, not just the happy path. Each of these is a best-effort side effect
// (device-local caching signals, never the primary operation they ride on
// in authStore.ts) that must degrade rather than throw, and must still log
// (docs/error-handling.md §2 — a legitimate swallow must never be silent).
test('hasLoggedInBefore degrades to false on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.marker, 'get').mockRejectedValue(new Error('IDB blocked'))

  expect(await hasLoggedInBefore()).toBe(false)
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('markLoggedIn is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.marker, 'put').mockRejectedValue(new Error('IDB blocked'))

  await expect(markLoggedIn()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('clearLoggedIn is safe to fire-and-forget: a delete failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.marker, 'delete').mockRejectedValue(new Error('IDB blocked'))

  await expect(clearLoggedIn()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

// specs.md §10.2.1 (Track AF, Wave 4.1 half 2): a guest's session-less
// biometric lock enrollment — device-scoped, no DEK/token to wrap.
test('no guest lock on a fresh device', async () => {
  expect(await getGuestLock()).toBeUndefined()
})

test('setGuestLock persists the credential id and last-active time', async () => {
  const credentialId = new Uint8Array([1, 2, 3])
  await setGuestLock({ credentialId, lastActiveAt: 1000 })

  const row = await getGuestLock()
  expect(row?.credentialId).toEqual(credentialId)
  expect(row?.lastActiveAt).toBe(1000)
})

test('clearGuestLock removes the enrollment', async () => {
  await setGuestLock({ credentialId: new Uint8Array([1]), lastActiveAt: 1000 })
  await clearGuestLock()
  expect(await getGuestLock()).toBeUndefined()
})

test('touchGuestLockActive updates only the last-active time', async () => {
  const credentialId = new Uint8Array([9, 9])
  await setGuestLock({ credentialId, lastActiveAt: 1000 })

  await touchGuestLockActive(2000)

  const row = await getGuestLock()
  expect(row?.lastActiveAt).toBe(2000)
  // A partial Dexie `update()` round-trips the untouched binary field back
  // as a plain numeric-keyed object, not a real Uint8Array (same quirk
  // `pinLock.test.ts` documents for `db.vault.update()`) — compare byte
  // content, not the representation.
  expect(
    Uint8Array.from(Object.values(row?.credentialId as unknown as Record<string, number>)),
  ).toEqual(credentialId)
})

test('getGuestLock degrades to undefined on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.guestLock, 'get').mockRejectedValue(new Error('IDB blocked'))

  expect(await getGuestLock()).toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('setGuestLock is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.guestLock, 'put').mockRejectedValue(new Error('IDB blocked'))

  await expect(
    setGuestLock({ credentialId: new Uint8Array([1]), lastActiveAt: 1 }),
  ).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('touchGuestLockActive is safe to fire-and-forget: an update failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.guestLock, 'update').mockRejectedValue(new Error('IDB blocked'))

  await expect(touchGuestLockActive(1)).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getDriveDecision degrades to undefined (unanswered) on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.driveDecision, 'get').mockRejectedValue(new Error('IDB blocked'))

  expect(await getDriveDecision()).toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('setDriveDecision is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.driveDecision, 'put').mockRejectedValue(new Error('IDB blocked'))

  await expect(setDriveDecision('connected')).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('clearDriveDecision is safe to fire-and-forget: a delete failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.driveDecision, 'delete').mockRejectedValue(new Error('IDB blocked'))

  await expect(clearDriveDecision()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getDeviceId mints an 8-char lowercase-alphanumeric id and persists it', async () => {
  const id = await getDeviceId()

  expect(id).toMatch(/^[0-9a-z]{8}$/)
  expect(await deviceDb.deviceId.get(1)).toEqual({ id: 1, value: id })
})

test('getDeviceId returns the same id on every call within a session (cached)', async () => {
  const first = await getDeviceId()
  const second = await getDeviceId()

  expect(second).toBe(first)
  // Concurrent callers before the first resolves must also converge on one
  // id, not a race where two mint two different ids.
  expect(await Promise.all([getDeviceId(), getDeviceId()])).toEqual([first, first])
})

test('getDeviceId reuses a previously persisted id instead of minting a new one', async () => {
  await deviceDb.deviceId.put({ id: 1, value: 'existing' })

  expect(await getDeviceId()).toBe('existing')
})

test('getDeviceId degrades to a fresh in-memory id on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.deviceId, 'get').mockRejectedValue(new Error('IDB blocked'))

  const id = await getDeviceId()

  expect(id).toMatch(/^[0-9a-z]{8}$/)
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

test('getDeviceId is safe to fire-and-forget on a persist failure: still resolves with a usable id', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.deviceId, 'put').mockRejectedValue(new Error('IDB blocked'))

  const id = await getDeviceId()

  expect(id).toMatch(/^[0-9a-z]{8}$/)
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})
