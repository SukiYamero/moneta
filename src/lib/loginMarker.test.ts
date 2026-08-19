import { afterEach, expect, test } from 'vitest'
import { clearLoggedIn, hasLoggedInBefore, markLoggedIn } from '@/lib/loginMarker'

afterEach(async () => {
  await clearLoggedIn()
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
