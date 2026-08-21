import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '@/lib/db'
import { deviceDb } from '@/lib/deviceStore'
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
  enableGuestLock,
  disableGuestLock,
  hasGuestLock,
  verifyGuestLock,
  markGuestLockActive,
  isGuestLockBackgroundExpired,
  GuestBiometricUnavailableError,
} from '@/lib/pinLock'
import type { AuthSession, GoogleUser } from '@/lib/auth'

const session: AuthSession = { accessToken: 'tok-abc', expiresAt: 9_999_999_999_000 }
const user: GoogleUser = { email: 'a@b.com', name: 'Ana' }

afterEach(async () => {
  await db.vault.clear()
})

test('enable then unlock with the correct PIN returns the session', async () => {
  expect(await hasVault()).toBe(false)
  await enableLock({ pin: '1234', session })
  expect(await hasVault()).toBe(true)

  const unlocked = await unlockWithPin('1234')
  expect(unlocked).toEqual({ session, user: null })
})

test('enable caches the profile alongside the session, and unlock returns both', async () => {
  await enableLock({ pin: '1234', session, user })

  const unlocked = await unlockWithPin('1234')
  expect(unlocked).toEqual({ session, user })
})

// specs.md §10.11 / docs/wave-3-plan.md §2.1(1): a vault written before the
// cached-profile envelope existed stored the bare AuthSession as its *whole*
// plaintext, no { v: 2, session, user } wrapper at all. Built here with the
// real WebCrypto primitives directly (not through enableLock, which only
// ever writes the new v2 shape now) so this is a genuine legacy fixture, not
// a restatement of the current encoder.
test('unlockWithPin decodes a legacy v1 vault (bare AuthSession, no envelope) backward-compatibly', async () => {
  await resetVault()
  const enc = new TextEncoder()
  const pinSalt = crypto.getRandomValues(new Uint8Array(16))
  const pinIterations = 1000
  const dek = crypto.getRandomValues(new Uint8Array(32))

  const pinBase = await crypto.subtle.importKey('raw', enc.encode('1234'), 'PBKDF2', false, [
    'deriveKey',
  ])
  const pinKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: pinSalt, iterations: pinIterations, hash: 'SHA-256' },
    pinBase,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  const pinWrapIv = crypto.getRandomValues(new Uint8Array(12))
  const dekWrappedByPin = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: pinWrapIv }, pinKey, dek),
  )

  const dekKey = await crypto.subtle.importKey('raw', dek, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const tokenIv = crypto.getRandomValues(new Uint8Array(12))
  const tokenCipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: tokenIv },
      dekKey,
      enc.encode(JSON.stringify(session)),
    ),
  )

  await db.vault.put({
    id: 1,
    schemaVersion: 1,
    tokenCipher,
    tokenIv,
    pinSalt,
    pinIterations,
    dekWrappedByPin,
    pinWrapIv,
    failedAttempts: 0,
    lastActiveAt: Date.now(),
  })

  expect(await unlockWithPin('1234')).toEqual({ session, user: null })
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
  expect(await unlockWithPin('1234')).toEqual({ session, user: null })
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
  await updateSession(refreshed, null)

  expect(await unlockWithPin('1234')).toEqual({ session: refreshed, user: null })
})

test('updateSession also refreshes the cached profile', async () => {
  await resetVault()
  await enableLock({ pin: '1234', session })

  const refreshedUser: GoogleUser = { email: 'fresh@b.com', name: 'Fresh Ana' }
  await updateSession(session, refreshedUser)

  expect(await unlockWithPin('1234')).toEqual({ session, user: refreshedUser })
})

test('forgetDek discards the in-memory key so updateSession requires a fresh unlock', async () => {
  await enableLock({ pin: '1234', session })
  forgetDek()
  await expect(updateSession(session, null)).rejects.toThrow('lock: not unlocked')
})

test('unlocking again after forgetDek restores a usable, refreshable session', async () => {
  await enableLock({ pin: '1234', session })
  forgetDek()

  const unlocked = await unlockWithPin('1234')
  expect(unlocked).toEqual({ session, user: null })

  const refreshed: AuthSession = { accessToken: 'tok-after-relock', expiresAt: 1_222_333_444_000 }
  await updateSession(refreshed, null)
  expect(await unlockWithPin('1234')).toEqual({ session: refreshed, user: null })
})

test('resetVault wipes the vault', async () => {
  await enableLock({ pin: '1234', session })
  await resetVault()
  expect(await hasVault()).toBe(false)
})

test("resetVault also clears this device's login marker, forcing a real re-login next time", async () => {
  const { hasLoggedInBefore, markLoggedIn } = await import('@/lib/deviceStore')
  await markLoggedIn()
  await enableLock({ pin: '1234', session })

  await resetVault()

  expect(await hasLoggedInBefore()).toBe(false)
})

// A lockout-forced or manual vault reset must not hand whoever unlocks next
// (possibly a different Google account, same device) the previous account's
// Drive decision (specs.md §11, 2026-08-19 — same finding as the marker
// above, applied to the Drive opt-in's own persisted twin).
test("resetVault also clears this device's persisted Drive decision", async () => {
  const { getDriveDecision, setDriveDecision } = await import('@/lib/deviceStore')
  await setDriveDecision('connected')
  await enableLock({ pin: '1234', session })

  await resetVault()

  expect(await getDriveDecision()).toBeUndefined()
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
  await updateSession(refreshed, null)
  const dekAfter = bytes((await db.vault.get(1))!.dekWrappedByPin)

  const unlocked = await unlockWithPin('1234')

  expect(unlocked).toEqual({ session: refreshed, user: null })
  expect(dekAfter).toEqual(dekBefore)
})

// Deterministic 32-byte PRF secret returned by both create and get.
const PRF_SECRET = new Uint8Array(32).fill(7).buffer

const mockWebAuthn = (prf: ArrayBuffer | undefined) => {
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
  expect(unlocked).toEqual({ session, user: null })

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
  expect(await unlockWithPin('1234')).toEqual({ session, user: null })
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

// specs.md §10.2.1 (Track AF, Wave 4.1 half 2): a guest's biometric lock is
// session-less — no AuthSession, no DEK, no envelope. WebAuthn mints a
// device-scoped credential whose *assertion succeeding* is the whole
// signal; nothing here wraps or decrypts anything.
describe('guest biometric lock (session-less, specs.md §10.2.1)', () => {
  afterEach(async () => {
    await disableGuestLock()
  })

  test('no guest lock enrolled on a fresh device', async () => {
    expect(await hasGuestLock()).toBe(false)
  })

  test('enableGuestLock mints a WebAuthn credential with no PRF extension — nothing to wrap', async () => {
    mockWebAuthn(undefined)
    await enableGuestLock()
    expect(await hasGuestLock()).toBe(true)

    const createSpy = navigator.credentials.create as ReturnType<typeof vi.fn>
    const createArg = createSpy.mock.calls.at(-1)![0] as {
      publicKey: PublicKeyCredentialCreationOptions
    }
    expect(createArg.publicKey.extensions).toBeUndefined()
  })

  test('a cancelled/failed registration throws GuestBiometricUnavailableError, enrolls nothing', async () => {
    vi.stubGlobal('navigator', {
      credentials: { create: vi.fn().mockResolvedValue(null) },
    })
    await expect(enableGuestLock()).rejects.toBeInstanceOf(GuestBiometricUnavailableError)
    expect(await hasGuestLock()).toBe(false)
  })

  // deviceStore.ts's setGuestLock() self-catches a storage failure — without
  // this check, enableGuestLock() would resolve successfully even though the
  // row never landed, leaving lockStore.guestLockEnabled `true` while
  // isGuestLockBackgroundExpired() reads "no row" as "never expired" and
  // never re-locks: a guest believing background re-lock is on when it
  // silently isn't, the unsafe direction.
  test('a credential that registers but silently fails to persist throws, not a false success', async () => {
    mockWebAuthn(undefined)
    const putSpy = vi.spyOn(deviceDb.guestLock, 'put').mockRejectedValue(new Error('IDB blocked'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(enableGuestLock()).rejects.toThrow()
    expect(await hasGuestLock()).toBe(false)

    putSpy.mockRestore()
    warn.mockRestore()
  })

  test('verifyGuestLock succeeds against the enrolled credential', async () => {
    mockWebAuthn(undefined)
    await enableGuestLock()

    await expect(verifyGuestLock()).resolves.toBeUndefined()

    const getSpy = navigator.credentials.get as ReturnType<typeof vi.fn>
    const getArg = getSpy.mock.calls.at(-1)![0] as {
      publicKey: PublicKeyCredentialRequestOptions
    }
    expect(getArg.publicKey.extensions).toBeUndefined()
  })

  test('verifyGuestLock throws when nothing is enrolled', async () => {
    await expect(verifyGuestLock()).rejects.toBeInstanceOf(GuestBiometricUnavailableError)
  })

  test('verifyGuestLock throws when the platform ceremony returns no assertion', async () => {
    mockWebAuthn(undefined)
    await enableGuestLock()
    vi.stubGlobal('navigator', {
      credentials: {
        create: vi.fn().mockResolvedValue(null),
        get: vi.fn().mockResolvedValue(null),
      },
    })
    await expect(verifyGuestLock()).rejects.toBeInstanceOf(GuestBiometricUnavailableError)
  })

  test('disableGuestLock clears the enrollment', async () => {
    mockWebAuthn(undefined)
    await enableGuestLock()
    await disableGuestLock()
    expect(await hasGuestLock()).toBe(false)
  })

  test('the guest lock and the account vault are independent', async () => {
    mockWebAuthn(undefined)
    await enableGuestLock()
    await enableLock({ pin: '1234', session })

    expect(await hasGuestLock()).toBe(true)
    expect(await hasVault()).toBe(true)

    await resetVault()
    expect(await hasVault()).toBe(false)
    expect(await hasGuestLock()).toBe(true)
  })

  test('guest background is expired only after the timeout elapses', async () => {
    mockWebAuthn(undefined)
    await enableGuestLock()
    await markGuestLockActive(1_000_000)
    expect(await isGuestLockBackgroundExpired(1_000_000 + BACKGROUND_TIMEOUT_MS - 1)).toBe(false)
    expect(await isGuestLockBackgroundExpired(1_000_000 + BACKGROUND_TIMEOUT_MS + 1)).toBe(true)
  })

  test('no guest lock is never background-expired', async () => {
    expect(await isGuestLockBackgroundExpired(Date.now())).toBe(false)
  })
})
