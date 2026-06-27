import { db, VAULT_ID, type LockVault } from '@/lib/db'
import type { AuthSession } from '@/lib/auth'

const PIN_ITERATIONS = 310_000
const MAX_ATTEMPTS = 5
export const BACKGROUND_TIMEOUT_MS = 7 * 60_000
const enc = new TextEncoder()
const dec = new TextDecoder()
const HKDF_INFO = enc.encode('moneta-lock-dek')

// WebCrypto's BufferSource requires an ArrayBuffer-backed view; TS 5.7+ widens a
// bare Uint8Array to ArrayBufferLike (incl. SharedArrayBuffer). Ours never are.
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

function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length))
}

function generateDek(): Bytes {
  return randomBytes(32)
}

function importAesKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function aesEncrypt(key: CryptoKey, data: Bytes): Promise<{ iv: Bytes; cipher: Bytes }> {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv, cipher: new Uint8Array(cipher) }
}

async function aesDecrypt(key: CryptoKey, iv: Bytes, cipher: Bytes): Promise<Bytes> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new Uint8Array(plain)
}

async function derivePinKey(pin: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function hasVault(): Promise<boolean> {
  return (await db.vault.get(VAULT_ID)) !== undefined
}

async function deriveBiometricKey(prfSecret: BufferSource): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prfSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function prfResult(credential: PublicKeyCredential): BufferSource | undefined {
  return credential.getClientExtensionResults().prf?.results?.first
}

async function evaluatePrf(credentialId: Bytes, prfSalt: Bytes): Promise<BufferSource | undefined> {
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

async function registerBiometric(
  prfSalt: Bytes,
): Promise<{ credentialId: Bytes; secret: BufferSource } | null> {
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'Moneta', id: location.hostname },
      user: { id: randomBytes(16), name: 'moneta-lock', displayName: 'Moneta lock' },
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

export async function isBiometricAvailable(): Promise<boolean> {
  const api = globalThis.PublicKeyCredential
  if (!api?.isUserVerifyingPlatformAuthenticatorAvailable) return false
  try {
    return await api.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function biometricEnabled(): Promise<boolean> {
  const vault = await db.vault.get(VAULT_ID)
  return vault?.biometric !== undefined
}

export async function enableLock(opts: {
  pin: string
  session: AuthSession
  biometric?: boolean
}): Promise<void> {
  const dek = generateDek()
  const dekKey = await importAesKey(dek)
  const token = await aesEncrypt(dekKey, enc.encode(JSON.stringify(opts.session)))

  const pinSalt = randomBytes(16)
  const pinKey = await derivePinKey(opts.pin, pinSalt, PIN_ITERATIONS)
  const pinWrap = await aesEncrypt(pinKey, dek)

  const vault: LockVault = {
    schemaVersion: 1,
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
}

export async function unlockWithBiometric(): Promise<AuthSession> {
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
  if (vault.failedAttempts !== 0) await db.vault.update(VAULT_ID, { failedAttempts: 0 })
  activeDek = dek
  return decryptSession(vault, dek)
}

// A partial db.vault.update() makes the store round-trip the untouched binary
// fields back as plain numeric-keyed objects, which WebCrypto rejects.
// Re-wrap them into a real Uint8Array before any crypto call.
function asBytes(v: unknown): Bytes {
  if (v instanceof Uint8Array) return Uint8Array.from(v)
  if (v instanceof ArrayBuffer) return new Uint8Array(v)
  if (ArrayBuffer.isView(v))
    return Uint8Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
  if (Array.isArray(v)) return Uint8Array.from(v as number[])
  if (v !== null && typeof v === 'object')
    return Uint8Array.from(Object.values(v as Record<string, number>))
  throw new TypeError('lock: expected binary field')
}

async function readVault(): Promise<LockVault> {
  const vault = await db.vault.get(VAULT_ID)
  if (!vault) throw new Error('lock: no vault')
  return vault
}

async function decryptSession(vault: LockVault, dek: Bytes): Promise<AuthSession> {
  const dekKey = await importAesKey(dek)
  const plain = await aesDecrypt(dekKey, asBytes(vault.tokenIv), asBytes(vault.tokenCipher))
  return JSON.parse(dec.decode(plain)) as AuthSession
}

export async function resetVault(): Promise<void> {
  await db.vault.delete(VAULT_ID)
  activeDek = null
}

export async function unlockWithPin(pin: string): Promise<AuthSession> {
  const vault = await readVault()
  if (vault.failedAttempts >= MAX_ATTEMPTS) throw new LockedOutError()

  const pinKey = await derivePinKey(pin, asBytes(vault.pinSalt), vault.pinIterations)
  let dek: Bytes
  try {
    dek = await aesDecrypt(pinKey, asBytes(vault.pinWrapIv), asBytes(vault.dekWrappedByPin))
  } catch {
    await db.vault.update(VAULT_ID, { failedAttempts: vault.failedAttempts + 1 })
    throw new WrongPinError()
  }

  if (vault.failedAttempts !== 0) await db.vault.update(VAULT_ID, { failedAttempts: 0 })
  activeDek = dek
  return decryptSession(vault, dek)
}

export async function updateSession(session: AuthSession): Promise<void> {
  if (!activeDek) throw new Error('lock: not unlocked')
  const dekKey = await importAesKey(activeDek)
  const token = await aesEncrypt(dekKey, enc.encode(JSON.stringify(session)))
  await db.vault.update(VAULT_ID, { tokenCipher: token.cipher, tokenIv: token.iv })
}

export async function markActive(now: number = Date.now()): Promise<void> {
  await db.vault.update(VAULT_ID, { lastActiveAt: now })
}

export async function isBackgroundExpired(now: number = Date.now()): Promise<boolean> {
  const vault = await db.vault.get(VAULT_ID)
  if (!vault) return false
  return now - vault.lastActiveAt > BACKGROUND_TIMEOUT_MS
}
