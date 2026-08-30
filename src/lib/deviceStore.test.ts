import { afterEach, expect, test, vi } from 'vitest'
import {
  __resetDeviceIdForTests,
  clearAdoptionConsent,
  clearDriveDecision,
  clearGuestLock,
  clearGuestUsed,
  clearLoggedIn,
  deviceDb,
  getAdoptedMovementIds,
  getAdoptionConsent,
  getDeviceId,
  getDriveDecision,
  getGuestLock,
  hasLoggedInBefore,
  hasUsedGuestBefore,
  markGuestUsed,
  markLoggedIn,
  markMovementAdopted,
  setAdoptionConsent,
  setDriveDecision,
  setGuestLock,
  touchGuestLockActive,
} from '@/lib/deviceStore'

afterEach(async () => {
  await clearLoggedIn()
  await clearDriveDecision()
  await clearGuestLock()
  await clearGuestUsed()
  await clearAdoptionConsent()
  await deviceDb.deviceId.clear()
  await deviceDb.adoptedMovements.clear()
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

test('no guest marker on a fresh device', async () => {
  expect(await hasUsedGuestBefore()).toBe(false)
})

test('markGuestUsed sets the marker', async () => {
  await markGuestUsed()
  expect(await hasUsedGuestBefore()).toBe(true)
})

test('clearGuestUsed removes the marker', async () => {
  await markGuestUsed()
  await clearGuestUsed()
  expect(await hasUsedGuestBefore()).toBe(false)
})

test('clearGuestUsed on an already-clear marker is a no-op, not an error', async () => {
  await expect(clearGuestUsed()).resolves.toBeUndefined()
  expect(await hasUsedGuestBefore()).toBe(false)
})

test('the login marker and the guest marker are independent', async () => {
  await markLoggedIn()
  await markGuestUsed()

  await clearGuestUsed()

  expect(await hasLoggedInBefore()).toBe(true)
  expect(await hasUsedGuestBefore()).toBe(false)
})

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
  expect(
    Uint8Array.from(Object.values(row?.credentialId as unknown as Record<string, number>)),
  ).toEqual(credentialId)
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

test('no adoption consent on a fresh device', async () => {
  expect(await getAdoptionConsent()).toBeUndefined()
})

test('setAdoptionConsent persists the target profile id and account key', async () => {
  await setAdoptionConsent({ profileId: 'p1', accountKey: 'ana@example.com' })

  expect(await getAdoptionConsent()).toEqual({
    id: 1,
    profileId: 'p1',
    accountKey: 'ana@example.com',
  })
})

test('setAdoptionConsent overwrites a previous consent', async () => {
  await setAdoptionConsent({ profileId: 'p1', accountKey: 'ana@example.com' })
  await setAdoptionConsent({ profileId: 'p2', accountKey: 'beto@example.com' })

  expect(await getAdoptionConsent()).toEqual({
    id: 1,
    profileId: 'p2',
    accountKey: 'beto@example.com',
  })
})

test('clearAdoptionConsent removes the consent', async () => {
  await setAdoptionConsent({ profileId: 'p1', accountKey: 'ana@example.com' })
  await clearAdoptionConsent()
  expect(await getAdoptionConsent()).toBeUndefined()
})

test('clearAdoptionConsent on an already-clear consent is a no-op, not an error', async () => {
  await expect(clearAdoptionConsent()).resolves.toBeUndefined()
  expect(await getAdoptionConsent()).toBeUndefined()
})

test('getAdoptedMovementIds is empty for movements never marked adopted', async () => {
  expect(await getAdoptedMovementIds('p1', ['m1', 'm2'])).toEqual(new Set())
})

test('markMovementAdopted marks only that movement id for that profile', async () => {
  await markMovementAdopted('p1', 'm1')

  expect(await getAdoptedMovementIds('p1', ['m1', 'm2'])).toEqual(new Set(['m1']))
  expect(await getAdoptedMovementIds('p2', ['m1'])).toEqual(new Set())
})

const READ_FAILURE_CASES = [
  {
    name: 'hasLoggedInBefore degrades to false',
    arrange: () => vi.spyOn(deviceDb.marker, 'get').mockRejectedValue(new Error('IDB blocked')),
    act: () => hasLoggedInBefore(),
    expected: false,
  },
  {
    name: 'hasUsedGuestBefore degrades to false',
    arrange: () =>
      vi.spyOn(deviceDb.guestMarker, 'get').mockRejectedValue(new Error('IDB blocked')),
    act: () => hasUsedGuestBefore(),
    expected: false,
  },
  {
    name: 'getGuestLock degrades to undefined',
    arrange: () => vi.spyOn(deviceDb.guestLock, 'get').mockRejectedValue(new Error('IDB blocked')),
    act: () => getGuestLock(),
    expected: undefined,
  },
  {
    name: 'getDriveDecision degrades to undefined',
    arrange: () =>
      vi.spyOn(deviceDb.driveDecision, 'get').mockRejectedValue(new Error('IDB blocked')),
    act: () => getDriveDecision(),
    expected: undefined,
  },
  {
    name: 'getAdoptionConsent degrades to undefined',
    arrange: () =>
      vi.spyOn(deviceDb.adoptionConsent, 'get').mockRejectedValue(new Error('IDB blocked')),
    act: () => getAdoptionConsent(),
    expected: undefined,
  },
] as const

test.each(READ_FAILURE_CASES)(
  '$name on a storage read failure, warning instead of throwing',
  async ({ arrange, act, expected }) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = arrange()

    expect(await act()).toBe(expected)
    expect(warn).toHaveBeenCalled()

    spy.mockRestore()
    warn.mockRestore()
  },
)

test('getAdoptedMovementIds degrades to an empty set (treating nothing as adopted) on a storage read failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const spy = vi.spyOn(deviceDb.adoptedMovements, 'bulkGet').mockRejectedValue(new Error('IDB blocked'))

  expect(await getAdoptedMovementIds('p1', ['m1'])).toEqual(new Set())
  expect(warn).toHaveBeenCalled()

  spy.mockRestore()
  warn.mockRestore()
})

const WRITE_FAILURE_CASES = [
  {
    name: 'markLoggedIn',
    arrange: () => vi.spyOn(deviceDb.marker, 'put').mockRejectedValue(new Error('IDB blocked')),
    act: () => markLoggedIn(),
  },
  {
    name: 'markGuestUsed',
    arrange: () =>
      vi.spyOn(deviceDb.guestMarker, 'put').mockRejectedValue(new Error('IDB blocked')),
    act: () => markGuestUsed(),
  },
  {
    name: 'setGuestLock',
    arrange: () => vi.spyOn(deviceDb.guestLock, 'put').mockRejectedValue(new Error('IDB blocked')),
    act: () => setGuestLock({ credentialId: new Uint8Array([1]), lastActiveAt: 1 }),
  },
  {
    name: 'setDriveDecision',
    arrange: () =>
      vi.spyOn(deviceDb.driveDecision, 'put').mockRejectedValue(new Error('IDB blocked')),
    act: () => setDriveDecision('connected'),
  },
  {
    name: 'setAdoptionConsent',
    arrange: () =>
      vi.spyOn(deviceDb.adoptionConsent, 'put').mockRejectedValue(new Error('IDB blocked')),
    act: () => setAdoptionConsent({ profileId: 'p1', accountKey: 'ana@example.com' }),
  },
  {
    name: 'markMovementAdopted',
    arrange: () =>
      vi.spyOn(deviceDb.adoptedMovements, 'put').mockRejectedValue(new Error('IDB blocked')),
    act: () => markMovementAdopted('p1', 'm1'),
  },
] as const

test.each(WRITE_FAILURE_CASES)(
  '$name is safe to fire-and-forget: a write failure is caught and logged, not thrown',
  async ({ arrange, act }) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = arrange()

    await expect(act()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()

    spy.mockRestore()
    warn.mockRestore()
  },
)

const MUTATION_FAILURE_CASES = [
  {
    name: 'clearLoggedIn (delete)',
    arrange: () => vi.spyOn(deviceDb.marker, 'delete').mockRejectedValue(new Error('IDB blocked')),
    act: () => clearLoggedIn(),
  },
  {
    name: 'clearGuestUsed (delete)',
    arrange: () =>
      vi.spyOn(deviceDb.guestMarker, 'delete').mockRejectedValue(new Error('IDB blocked')),
    act: () => clearGuestUsed(),
  },
  {
    name: 'touchGuestLockActive (update)',
    arrange: () =>
      vi.spyOn(deviceDb.guestLock, 'update').mockRejectedValue(new Error('IDB blocked')),
    act: () => touchGuestLockActive(1),
  },
  {
    name: 'clearDriveDecision (delete)',
    arrange: () =>
      vi.spyOn(deviceDb.driveDecision, 'delete').mockRejectedValue(new Error('IDB blocked')),
    act: () => clearDriveDecision(),
  },
  {
    name: 'clearAdoptionConsent (delete)',
    arrange: () =>
      vi.spyOn(deviceDb.adoptionConsent, 'delete').mockRejectedValue(new Error('IDB blocked')),
    act: () => clearAdoptionConsent(),
  },
] as const

test.each(MUTATION_FAILURE_CASES)(
  '$name is safe to fire-and-forget: a failure is caught and logged, not thrown',
  async ({ arrange, act }) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = arrange()

    await expect(act()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()

    spy.mockRestore()
    warn.mockRestore()
  },
)
