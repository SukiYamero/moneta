import { db, VAULT_ID, type LockVault } from '@/lib/db'
import type { AuthSession, GoogleUser } from '@/lib/auth'
import { APP_NAME } from '@/lib/branding'
import {
  clearDriveDecision,
  clearGuestLock,
  clearLoggedIn,
  deviceDb,
  getGuestLock,
  GUEST_LOCK_ID,
  hasLoggedInBefore,
  hasUsedGuestBefore,
  setGuestLock,
  touchGuestLockActive,
} from '@/lib/deviceStore'

export type VaultSession = { session: AuthSession; user: GoogleUser | null }

const PIN_ITERATIONS = 310_000
const MAX_ATTEMPTS = 5
export const BACKGROUND_TIMEOUT_MS = 7 * 60_000
const enc = new TextEncoder()
const dec = new TextDecoder()
const HKDF_INFO = enc.encode('kurobello-lock-dek')

// TS 5.7+ widens a bare Uint8Array to ArrayBufferLike (incl. SharedArrayBuffer);
// WebCrypto's BufferSource requires an ArrayBuffer-backed view.
type Bytes = Uint8Array<ArrayBuffer>

let activeDek: Bytes | null = null

export class WrongPinError extends Error {
  constructor() {
    super('lock: wrong pin')
    this.name = 'WrongPinError'
  }
}

export class LockedOutError extends Error {
  constructor() {
    super('lock: too many attempts')
    this.name = 'LockedOutError'
  }
}

export class BiometricUnavailableError extends Error {
  constructor() {
    super('lock: biometric unavailable')
    this.name = 'BiometricUnavailableError'
  }
}

export class GuestBiometricUnavailableError extends Error {
  constructor() {
    super('lock: guest biometric unavailable')
    this.name = 'GuestBiometricUnavailableError'
  }
}

const randomBytes = (length: number): Bytes => {
  return crypto.getRandomValues(new Uint8Array(length))
}

const generateDek = (): Bytes => {
  return randomBytes(32)
}

const importAesKey = (raw: Bytes): Promise<CryptoKey> => {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

const aesEncrypt = async (key: CryptoKey, data: Bytes): Promise<{ iv: Bytes; cipher: Bytes }> => {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv, cipher: new Uint8Array(cipher) }
}

const aesDecrypt = async (key: CryptoKey, iv: Bytes, cipher: Bytes): Promise<Bytes> => {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new Uint8Array(plain)
}

const derivePinKey = async (pin: string, salt: Bytes, iterations: number): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const hasVault = async (): Promise<boolean> => {
  return (await db.vault.get(VAULT_ID)) !== undefined
}

const deriveBiometricKey = async (prfSecret: BufferSource): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', prfSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const prfResult = (credential: PublicKeyCredential): BufferSource | undefined => {
  return credential.getClientExtensionResults().prf?.results?.first
}

const evaluatePrf = async (
  credentialId: Bytes,
  prfSalt: Bytes,
): Promise<BufferSource | undefined> => {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  })) as PublicKeyCredential | null
  return assertion ? prfResult(assertion) : undefined
}

const registerBiometric = async (
  prfSalt: Bytes,
): Promise<{ credentialId: Bytes; secret: BufferSource } | null> => {
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: APP_NAME, id: location.hostname },
      user: { id: randomBytes(16), name: 'kurobello-lock', displayName: `${APP_NAME} lock` },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  })) as PublicKeyCredential | null
  if (!created) return null

  const credentialId = new Uint8Array(created.rawId)
  const secret = await evaluatePrf(credentialId, prfSalt)
  return secret ? { credentialId, secret } : null
}

export const isBiometricAvailable = async (): Promise<boolean> => {
  const api = globalThis.PublicKeyCredential
  if (!api?.isUserVerifyingPlatformAuthenticatorAvailable) return false
  try {
    return await api.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch (e) {
    console.warn('lock: could not probe platform authenticator availability', e)
    return false
  }
}

export const biometricEnabled = async (): Promise<boolean> => {
  const vault = await db.vault.get(VAULT_ID)
  return vault?.biometric !== undefined
}

type VaultPayloadV2 = { v: 2; session: AuthSession; user: GoogleUser | null }

const encodeVaultPayload = (session: AuthSession, user: GoogleUser | null): Bytes => {
  const payload: VaultPayloadV2 = { v: 2, session, user }
  return enc.encode(JSON.stringify(payload))
}

const isVaultPayloadV2 = (v: unknown): v is VaultPayloadV2 => {
  return typeof v === 'object' && v !== null && (v as { v?: unknown }).v === 2
}

const decodeVaultPayload = (json: string): VaultSession => {
  const parsed: unknown = JSON.parse(json)
  if (isVaultPayloadV2(parsed)) return { session: parsed.session, user: parsed.user }
  return { session: parsed as AuthSession, user: null }
}

export const enableLock = async (opts: {
  pin: string
  session: AuthSession
  user?: GoogleUser | null
  biometric?: boolean
}): Promise<void> => {
  const dek = generateDek()
  const dekKey = await importAesKey(dek)
  const token = await aesEncrypt(dekKey, encodeVaultPayload(opts.session, opts.user ?? null))

  const pinSalt = randomBytes(16)
  const pinKey = await derivePinKey(opts.pin, pinSalt, PIN_ITERATIONS)
  const pinWrap = await aesEncrypt(pinKey, dek)

  const vault: LockVault = {
    schemaVersion: 2,
    tokenCipher: token.cipher,
    tokenIv: token.iv,
    pinSalt,
    pinIterations: PIN_ITERATIONS,
    dekWrappedByPin: pinWrap.cipher,
    pinWrapIv: pinWrap.iv,
    failedAttempts: 0,
    lastActiveAt: Date.now(),
  }

  if (opts.biometric) {
    const prfSalt = randomBytes(32)
    const registered = await registerBiometric(prfSalt)
    if (registered) {
      const bioKey = await deriveBiometricKey(registered.secret)
      const bioWrap = await aesEncrypt(bioKey, dek)
      vault.biometric = {
        credentialId: registered.credentialId,
        prfSalt,
        dekWrappedByPrf: bioWrap.cipher,
        prfWrapIv: bioWrap.iv,
      }
    }
  }

  await db.vault.put({ id: VAULT_ID, ...vault })
  activeDek = dek
}

// A partial db.vault.update() round-trips untouched binary fields back as plain
// numeric-keyed objects, which WebCrypto rejects — re-wrap them into a real Uint8Array.
const asBytes = (v: unknown): Bytes => {
  if (v instanceof Uint8Array) return Uint8Array.from(v)
  if (v instanceof ArrayBuffer) return new Uint8Array(v)
  if (ArrayBuffer.isView(v))
    return Uint8Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
  if (Array.isArray(v)) return Uint8Array.from(v as number[])
  if (v !== null && typeof v === 'object')
    return Uint8Array.from(Object.values(v as Record<string, number>))
  throw new TypeError('lock: expected binary field')
}

const readVault = async (): Promise<LockVault> => {
  const vault = await db.vault.get(VAULT_ID)
  if (!vault) throw new Error('lock: no vault')
  return vault
}

const decryptVaultPayload = async (vault: LockVault, dek: Bytes): Promise<VaultSession> => {
  const dekKey = await importAesKey(dek)
  const plain = await aesDecrypt(dekKey, asBytes(vault.tokenIv), asBytes(vault.tokenCipher))
  return decodeVaultPayload(dec.decode(plain))
}

export const unlockWithBiometric = async (): Promise<VaultSession> => {
  const vault = await readVault()
  if (!vault.biometric) throw new BiometricUnavailableError()
  const secret = await evaluatePrf(
    asBytes(vault.biometric.credentialId),
    asBytes(vault.biometric.prfSalt),
  )
  if (!secret) throw new BiometricUnavailableError()

  const bioKey = await deriveBiometricKey(secret)
  const dek = await aesDecrypt(
    bioKey,
    asBytes(vault.biometric.prfWrapIv),
    asBytes(vault.biometric.dekWrappedByPrf),
  )
  await db.vault.update(VAULT_ID, { failedAttempts: 0 })
  activeDek = dek
  return decryptVaultPayload(vault, dek)
}

export const forgetDek = (): void => {
  activeDek = null
}

export const resetVault = async (): Promise<void> => {
  await db.vault.delete(VAULT_ID)
  forgetDek()
  await clearLoggedIn()
  await clearDriveDecision()
}

export const unlockWithPin = async (pin: string): Promise<VaultSession> => {
  const vault = await readVault()
  if (vault.failedAttempts >= MAX_ATTEMPTS) throw new LockedOutError()

  const pinKey = await derivePinKey(pin, asBytes(vault.pinSalt), vault.pinIterations)
  let dek: Bytes
  try {
    dek = await aesDecrypt(pinKey, asBytes(vault.pinWrapIv), asBytes(vault.dekWrappedByPin))
  } catch {
    await db.transaction('rw', db.vault, async () => {
      const current = await db.vault.get(VAULT_ID)
      await db.vault.update(VAULT_ID, { failedAttempts: (current?.failedAttempts ?? 0) + 1 })
    })
    throw new WrongPinError()
  }

  await db.vault.update(VAULT_ID, { failedAttempts: 0 })
  activeDek = dek
  return decryptVaultPayload(vault, dek)
}

export const updateSession = async (
  session: AuthSession,
  user: GoogleUser | null,
): Promise<void> => {
  if (!activeDek) throw new Error('lock: not unlocked')
  const dekKey = await importAesKey(activeDek)
  const token = await aesEncrypt(dekKey, encodeVaultPayload(session, user))
  await db.vault.update(VAULT_ID, {
    tokenCipher: token.cipher,
    tokenIv: token.iv,
    schemaVersion: 2,
  })
}

export const markActive = async (now: number = Date.now()): Promise<void> => {
  try {
    await db.vault.update(VAULT_ID, { lastActiveAt: now })
  } catch (e) {
    console.warn('lock: failed to record last-active time', e)
  }
}

export const isBackgroundExpired = async (now: number = Date.now()): Promise<boolean> => {
  const vault = await db.vault.get(VAULT_ID)
  if (!vault) return false
  return now - vault.lastActiveAt > BACKGROUND_TIMEOUT_MS
}

export { hasLoggedInBefore, hasUsedGuestBefore }

const registerGuestCredential = async (): Promise<Bytes | null> => {
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: APP_NAME, id: location.hostname },
      user: {
        id: randomBytes(16),
        name: 'kurobello-guest-lock',
        displayName: `${APP_NAME} guest lock`,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
    },
  })) as PublicKeyCredential | null
  return created ? new Uint8Array(created.rawId) : null
}

export const enableGuestLock = async (): Promise<void> => {
  const credentialId = await registerGuestCredential()
  if (!credentialId) throw new GuestBiometricUnavailableError()
  await setGuestLock({ credentialId, lastActiveAt: Date.now() })
  if (!(await hasGuestLock())) throw new Error('lock: guest lock could not be saved')
}

export const disableGuestLock = async (): Promise<void> => {
  await clearGuestLock()
}

export const hasGuestLock = async (): Promise<boolean> => {
  return (await getGuestLock()) !== undefined
}

export const verifyGuestLock = async (): Promise<void> => {
  const row = await getGuestLock()
  if (!row) throw new GuestBiometricUnavailableError()

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: asBytes(row.credentialId) }],
      userVerification: 'required',
    },
  })) as PublicKeyCredential | null
  if (!assertion) throw new GuestBiometricUnavailableError()

  await touchGuestLockActive()
}

export const markGuestLockActive = touchGuestLockActive

export const isGuestLockBackgroundExpired = async (now: number = Date.now()): Promise<boolean> => {
  const row = await deviceDb.guestLock.get(GUEST_LOCK_ID)
  if (!row) return false
  return now - row.lastActiveAt > BACKGROUND_TIMEOUT_MS
}
