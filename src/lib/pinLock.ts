import { db, VAULT_ID, type LockVault } from '@/lib/db'
import type { AuthSession } from '@/lib/auth'
import { APP_NAME } from '@/lib/branding'
import { clearLoggedIn } from '@/lib/loginMarker'

const PIN_ITERATIONS = 310_000
const MAX_ATTEMPTS = 5
export const BACKGROUND_TIMEOUT_MS = 7 * 60_000
const enc = new TextEncoder()
const dec = new TextDecoder()
// Frozen: changing this string breaks decryption of every existing vault.
const HKDF_INFO = enc.encode('kurobello-lock-dek')

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
    // Legitimate swallow: a platform-capability probe failing just means
    // "no biometrics" (the mandatory PIN fallback always exists), but per
    // docs/error-handling.md §2 a legitimate swallow must still say why and
    // never be silent.
    console.warn('lock: could not probe platform authenticator availability', e)
    return false
  }
}

export const biometricEnabled = async (): Promise<boolean> => {
  const vault = await db.vault.get(VAULT_ID)
  return vault?.biometric !== undefined
}

export const enableLock = async (opts: {
  pin: string
  session: AuthSession
  biometric?: boolean
}): Promise<void> => {
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
  // Enabling the lock is conceptually the same act as unlocking it — the user
  // just proved knowledge of the PIN by setting it — so this tab shouldn't need
  // a separate unlock before updateSession works.
  activeDek = dek
}

// A partial db.vault.update() makes the store round-trip the untouched binary
// fields back as plain numeric-keyed objects, which WebCrypto rejects.
// Re-wrap them into a real Uint8Array before any crypto call.
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

const decryptSession = async (vault: LockVault, dek: Bytes): Promise<AuthSession> => {
  const dekKey = await importAesKey(dek)
  const plain = await aesDecrypt(dekKey, asBytes(vault.tokenIv), asBytes(vault.tokenCipher))
  return JSON.parse(dec.decode(plain)) as AuthSession
}

export const unlockWithBiometric = async (): Promise<AuthSession> => {
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
  // Unconditional, not "if failedAttempts !== 0 then reset": a write that
  // doesn't depend on a prior read can never lose a concurrent update, so
  // there is nothing to make atomic here (unlike the increment below).
  await db.vault.update(VAULT_ID, { failedAttempts: 0 })
  activeDek = dek
  return decryptSession(vault, dek)
}

// The only place module-level key material is discarded. Exported so callers
// (lockStore, on any transition into the locked phase) can make the key
// disappear without reaching into pinLock's module state themselves.
export const forgetDek = (): void => {
  activeDek = null
}

export const resetVault = async (): Promise<void> => {
  await db.vault.delete(VAULT_ID)
  forgetDek()
  // The vault and this device's "has logged in before" signal are wiped
  // together: both lockStore.resume()'s lockout branch and lockStore.reset()
  // funnel through here, and specs.md §11 (2026-08-19) requires both paths
  // to force a genuine, non-silent Google re-login next time.
  await clearLoggedIn()
}

export const unlockWithPin = async (pin: string): Promise<AuthSession> => {
  const vault = await readVault()
  if (vault.failedAttempts >= MAX_ATTEMPTS) throw new LockedOutError()

  const pinKey = await derivePinKey(pin, asBytes(vault.pinSalt), vault.pinIterations)
  let dek: Bytes
  try {
    dek = await aesDecrypt(pinKey, asBytes(vault.pinWrapIv), asBytes(vault.dekWrappedByPin))
  } catch {
    // Atomic read -> increment, inside one Dexie 'rw' transaction: two
    // concurrent wrong PINs must not both read the same stale failedAttempts
    // and each write "current + 1", losing an attempt and defeating the
    // 5-attempt throttle that is this app's entire brute-force defense for a
    // 4-digit PIN (specs.md §5). Mirrors the transactional read-modify-write
    // pattern already used by repo.local.ts's update()/remove() — the
    // identical race, closed the same way.
    await db.transaction('rw', db.vault, async () => {
      const current = await db.vault.get(VAULT_ID)
      await db.vault.update(VAULT_ID, { failedAttempts: (current?.failedAttempts ?? 0) + 1 })
    })
    throw new WrongPinError()
  }

  // Unconditional, not "if failedAttempts !== 0 then reset": see the
  // matching comment on unlockWithBiometric's reset above.
  await db.vault.update(VAULT_ID, { failedAttempts: 0 })
  activeDek = dek
  return decryptSession(vault, dek)
}

export const updateSession = async (session: AuthSession): Promise<void> => {
  if (!activeDek) throw new Error('lock: not unlocked')
  const dekKey = await importAesKey(activeDek)
  const token = await aesEncrypt(dekKey, enc.encode(JSON.stringify(session)))
  await db.vault.update(VAULT_ID, { tokenCipher: token.cipher, tokenIv: token.iv })
}

export const markActive = async (now: number = Date.now()): Promise<void> => {
  try {
    await db.vault.update(VAULT_ID, { lastActiveAt: now })
  } catch (e) {
    // lockStore.onHidden() calls this as `void markActive()` (docs/error-
    // handling.md §7: a void call site is only safe when the action self-
    // catches). Best-effort: a missed write just means the next
    // isBackgroundExpired() check compares against a slightly stale
    // timestamp — isBackgroundExpired's own caller (lockStore.onVisible)
    // already fails closed (re-locks) if that read itself fails, so this
    // side effect being lossy is not a security gap on its own.
    console.warn('lock: failed to record last-active time', e)
  }
}

export const isBackgroundExpired = async (now: number = Date.now()): Promise<boolean> => {
  const vault = await db.vault.get(VAULT_ID)
  if (!vault) return false
  return now - vault.lastActiveAt > BACKGROUND_TIMEOUT_MS
}
