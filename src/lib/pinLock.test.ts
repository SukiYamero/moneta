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
  forgetDek,
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

test('concurrent wrong PINs each count exactly once — no lost updates', async () => {
  // Reproduces the operator-verified race: unlockWithPin used to read
  // failedAttempts once at the top and write "read value + 1" back in its
  // catch, so three concurrent wrong PINs — each reading the same stale 0 —
  // all wrote 1, losing two attempts. Firing genuinely concurrent guesses is
  // trivial from a devtools console, so this is the whole brute-force
  // throttle (specs.md §5) failing silently, not a tidiness issue.
  await enableLock({ pin: '1234', session })
  await Promise.allSettled([unlockWithPin('0000'), unlockWithPin('0001'), unlockWithPin('0002')])
  const after = await db.vault.get(1)
  expect(after?.failedAttempts).toBe(3)
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

test('enableLock leaves the vault unlocked in this tab, no separate unlock needed', async () => {
  // Start from a known no-vault, no-activeDek state — activeDek is module-level
  // and otherwise could carry over from a DEK a previous test unlocked with.
  await resetVault()
  await enableLock({ pin: '1234', session })

  const refreshed: AuthSession = { accessToken: 'tok-fresh', expiresAt: 1_234_567_890_000 }
  await updateSession(refreshed)

  expect(await unlockWithPin('1234')).toEqual(refreshed)
})

test('forgetDek discards the in-memory key so updateSession requires a fresh unlock', async () => {
  await enableLock({ pin: '1234', session })
  forgetDek()
  await expect(updateSession(session)).rejects.toThrow('lock: not unlocked')
})

test('unlocking again after forgetDek restores a usable, refreshable session', async () => {
  await enableLock({ pin: '1234', session })
  forgetDek()

  const unlocked = await unlockWithPin('1234')
  expect(unlocked).toEqual(session)

  const refreshed: AuthSession = { accessToken: 'tok-after-relock', expiresAt: 1_222_333_444_000 }
  await updateSession(refreshed)
  expect(await unlockWithPin('1234')).toEqual(refreshed)
})

test('resetVault wipes the vault', async () => {
  await enableLock({ pin: '1234', session })
  await resetVault()
  expect(await hasVault()).toBe(false)
})

test("resetVault also clears this device's login marker, forcing a real re-login next time", async () => {
  const { hasLoggedInBefore, markLoggedIn } = await import('@/lib/loginMarker')
  await markLoggedIn()
  await enableLock({ pin: '1234', session })

  await resetVault()

  expect(await hasLoggedInBefore()).toBe(false)
})

test('markActive is safe to fire-and-forget: a write failure is caught and logged, not thrown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await enableLock({ pin: '1234', session })
  const updateSpy = vi.spyOn(db.vault, 'update').mockRejectedValue(new Error('IDB write blocked'))

  await expect(markActive()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()

  updateSpy.mockRestore()
  warn.mockRestore()
})

test('isBiometricAvailable logs and degrades to false when the platform probe throws', async () => {
  vi.stubGlobal('PublicKeyCredential', {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(new Error('boom')),
  })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  expect(await isBiometricAvailable()).toBe(false)
  expect(warn).toHaveBeenCalled()

  warn.mockRestore()
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
