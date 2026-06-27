import { db, VAULT_ID, type LockVault } from '@/lib/db'
import type { AuthSession } from '@/lib/auth'

const PIN_ITERATIONS = 310_000
const MAX_ATTEMPTS = 5
const enc = new TextEncoder()
const dec = new TextDecoder()

// WebCrypto's BufferSource requires an ArrayBuffer-backed view; TS 5.7+ widens a
// bare Uint8Array to ArrayBufferLike (incl. SharedArrayBuffer). Ours never are.
type Bytes = Uint8Array<ArrayBuffer>

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

export async function enableLock(opts: { pin: string; session: AuthSession }): Promise<void> {
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
  await db.vault.put({ id: VAULT_ID, ...vault })
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
  return decryptSession(vault, dek)
}
