import { afterEach, expect, test, vi } from 'vitest'
import {
  clearDriveDecision,
  clearLoggedIn,
  deviceDb,
  getDriveDecision,
  hasLoggedInBefore,
  markLoggedIn,
  setDriveDecision,
} from '@/lib/deviceStore'

afterEach(async () => {
  await clearLoggedIn()
  await clearDriveDecision()
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
