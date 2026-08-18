import Dexie, { type EntityTable } from 'dexie'

export const VAULT_ID = 1 as const

export type LockVault = {
  schemaVersion: number
  tokenCipher: Uint8Array
  tokenIv: Uint8Array
  pinSalt: Uint8Array
  pinIterations: number
  dekWrappedByPin: Uint8Array
  pinWrapIv: Uint8Array
  biometric?: {
    credentialId: Uint8Array
    prfSalt: Uint8Array
    dekWrappedByPrf: Uint8Array
    prfWrapIv: Uint8Array
  }
  failedAttempts: number
  lastActiveAt: number
}

type VaultRow = LockVault & { id: number }

// Storage id frozen at the 2026-08-18 brand: renaming it orphans the local
// vault, so it must not track APP_NAME.
export const db = new Dexie('kurobello') as Dexie & {
  vault: EntityTable<VaultRow, 'id'>
}

db.version(1).stores({ vault: 'id' })
