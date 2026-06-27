import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/lib/db'
import {
  enableLock,
  hasVault,
  unlockWithPin,
  WrongPinError,
  LockedOutError,
  resetVault,
  updateSession,
  biometricEnabled,
  BiometricUnavailableError,
  isBiometricAvailable,
  unlockWithBiometric,
  BACKGROUND_TIMEOUT_MS,
  markActive,
  isBackgroundExpired,
} from '@/lib/pinLock'
import type { AuthSession } from '@/lib/auth'

const session: AuthSession = { accessToken: 'tok-abc', expiresAt: 9_999_999_999_000 }

afterEach(async () => {
  await db.vault.clear()
})

test('enable then unlock with the correct PIN returns the session', async () => {
  expect(await hasVault()).toBe(false)
  await enableLock({ pin: '1234', session })
  expect(await hasVault()).toBe(true)

  const unlocked = await unlockWithPin('1234')
  expect(unlocked).toEqual(session)
})

test('wrong PIN throws WrongPinError', async () => {
  await enableLock({ pin: '1234', session })
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
})

test('five wrong PINs lock out further attempts', async () => {
  await enableLock({ pin: '1234', session })
  for (let i = 0; i < 5; i++) {
    await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  }
  await expect(unlockWithPin('1234')).rejects.toBeInstanceOf(LockedOutError)
})

test('a correct PIN resets the failed-attempt counter', async () => {
  await enableLock({ pin: '1234', session })
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  await unlockWithPin('1234')
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  const after = await db.vault.get(1)
  expect(after?.failedAttempts).toBe(1)
})

test('four wrong PINs then a correct PIN still unlocks and resets the counter', async () => {
  await enableLock({ pin: '1234', session })
  for (let i = 0; i < 4; i++) {
    await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  }
  expect(await unlockWithPin('1234')).toEqual(session)
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  const after = await db.vault.get(1)
  expect(after?.failedAttempts).toBe(1)
})

test('resetVault wipes the vault', async () => {
  await enableLock({ pin: '1234', session })
  await resetVault()
  expect(await hasVault()).toBe(false)
})

test('updateSession re-encrypts a refreshed token under the same DEK', async () => {
  await enableLock({ pin: '1234', session })
  await unlockWithPin('1234')

  const refreshed: AuthSession = { accessToken: 'tok-new', expiresAt: 1_111_111_111_000 }

  // A partial vault.update round-trips untouched binary fields as plain
  // numeric-keyed objects, so compare byte content, not the representation.
  const bytes = (v: unknown) => Uint8Array.from(Object.values(v as Record<string, number>))
  const dekBefore = bytes((await db.vault.get(1))!.dekWrappedByPin)
  await updateSession(refreshed)
  const dekAfter = bytes((await db.vault.get(1))!.dekWrappedByPin)

  const unlocked = await unlockWithPin('1234')

  expect(unlocked).toEqual(refreshed)
  expect(dekAfter).toEqual(dekBefore)
})

// Deterministic 32-byte PRF secret returned by both create and get.
const PRF_SECRET = new Uint8Array(32).fill(7).buffer

function mockWebAuthn(prf: ArrayBuffer | undefined) {
  const credentialId = new Uint8Array([9, 9, 9])
  const extResults = prf ? { prf: { results: { first: prf } } } : { prf: {} }
  const credential = {
    rawId: credentialId.buffer,
    getClientExtensionResults: () => extResults,
  }
  vi.stubGlobal('navigator', {
    credentials: {
      create: vi.fn().mockResolvedValue(credential),
      get: vi.fn().mockResolvedValue(credential),
    },
  })
  vi.stubGlobal('PublicKeyCredential', {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
  })
  vi.stubGlobal('location', { hostname: 'localhost' })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

test('isBiometricAvailable reflects platform authenticator support', async () => {
  mockWebAuthn(PRF_SECRET)
  expect(await isBiometricAvailable()).toBe(true)
})

test('enable with biometric then unlock via PRF returns the session', async () => {
  mockWebAuthn(PRF_SECRET)
  await enableLock({ pin: '1234', session, biometric: true })
  expect(await biometricEnabled()).toBe(true)

  const unlocked = await unlockWithBiometric()
  expect(unlocked).toEqual(session)

  const getSpy = navigator.credentials.get as ReturnType<typeof vi.fn>
  // enableLock's registration also calls get; the LAST call is the unlock ceremony.
  const getArg = getSpy.mock.calls.at(-1)![0] as { publicKey: PublicKeyCredentialRequestOptions }
  const passedSalt = new Uint8Array(getArg.publicKey.extensions!.prf!.eval!.first as ArrayBuffer)
  const storedSalt = (await db.vault.get(1))!.biometric!.prfSalt
  // vault binary fields round-trip as plain numeric-keyed objects:
  const toBytes = (v: unknown) => Uint8Array.from(Object.values(v as Record<string, number>))
  expect(passedSalt).toEqual(toBytes(storedSalt))
})

test('PIN still unlocks when biometric is enabled', async () => {
  mockWebAuthn(PRF_SECRET)
  await enableLock({ pin: '1234', session, biometric: true })
  expect(await unlockWithPin('1234')).toEqual(session)
})

test('biometric unlock clears the PIN throttle', async () => {
  mockWebAuthn(PRF_SECRET)
  await enableLock({ pin: '1234', session, biometric: true })
  for (let i = 0; i < 3; i++) {
    await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  }
  await unlockWithBiometric()
  expect((await db.vault.get(1))!.failedAttempts).toBe(0)
})

test('no PRF result -> no biometric envelope written (PIN-only)', async () => {
  mockWebAuthn(undefined)
  await enableLock({ pin: '1234', session, biometric: true })
  expect(await biometricEnabled()).toBe(false)
  await expect(unlockWithBiometric()).rejects.toBeInstanceOf(BiometricUnavailableError)
})

test('background is expired only after the timeout elapses', async () => {
  await enableLock({ pin: '1234', session })
  await markActive(1_000_000)
  expect(await isBackgroundExpired(1_000_000 + BACKGROUND_TIMEOUT_MS - 1)).toBe(false)
  expect(await isBackgroundExpired(1_000_000 + BACKGROUND_TIMEOUT_MS + 1)).toBe(true)
})

test('no vault is never background-expired', async () => {
  expect(await isBackgroundExpired(Date.now())).toBe(false)
})
