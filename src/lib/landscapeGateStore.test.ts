import { expect, test, vi } from 'vitest'

test('a fresh session has not skipped the landscape gate', async () => {
  const { useLandscapeGateStore } = await import('@/lib/landscapeGateStore')
  expect(useLandscapeGateStore.getState().skippedThisSession).toBe(false)
})

test('skipLandscapeGateForSession marks the rest of the session skipped', async () => {
  const { useLandscapeGateStore, skipLandscapeGateForSession } =
    await import('@/lib/landscapeGateStore')
  skipLandscapeGateForSession()
  expect(useLandscapeGateStore.getState().skippedThisSession).toBe(true)
})

test('a new session (fresh module state) is not skipped, even if a previous session skipped it', async () => {
  const first = await import('@/lib/landscapeGateStore')
  first.skipLandscapeGateForSession()
  expect(first.useLandscapeGateStore.getState().skippedThisSession).toBe(true)

  vi.resetModules()

  const second = await import('@/lib/landscapeGateStore')
  expect(second.useLandscapeGateStore.getState().skippedThisSession).toBe(false)
})
