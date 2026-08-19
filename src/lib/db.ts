import Dexie, { type EntityTable } from 'dexie'
import type { Activo, Config, Movimiento } from '@/lib/schema'

export const VAULT_ID = 1 as const
export const CONFIG_ID = 1 as const

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

// Config is one JSON file (appDataFolder), so it's cached as a single row
// keyed by a fixed synthetic id — same pattern as VaultRow above.
export type ConfigRow = Config & { id: number }

// Storage id frozen at the 2026-08-18 brand: renaming it orphans the local
// vault, so it must not track APP_NAME.
export const db = new Dexie('kurobello') as Dexie & {
  vault: EntityTable<VaultRow, 'id'>
  movimientos: EntityTable<Movimiento, 'id'>
  activos: EntityTable<Activo, 'id'>
  config: EntityTable<ConfigRow, 'id'>
}

db.version(1).stores({ vault: 'id' })

// Additive: `vault` keeps its v1 definition unchanged (frozen, per AGENTS.md).
// Indexes are chosen to serve `ListQuery` (repo.ts §10.3):
//  - `fecha` / `fechaActualizacion`: single-field range scans for
//    dateFrom/dateTo and the default sort when no `seccion` filter is given.
//  - `seccion`: exact-match scans when no date range is given.
//  - `[seccion+fecha]` / `[seccion+fechaActualizacion]`: compound range scan
//    for the common case of filtering by section AND a date range together —
//    avoids a full-table scan + in-memory filter for that combination.
// `createdAt` is NOT indexed: it's only ever used as an in-memory sort
// tiebreak, never queried via `.where()`, so an index on it would serve
// nothing.
db.version(2).stores({
  vault: 'id',
  movimientos: 'id, fecha, seccion, [seccion+fecha]',
  activos: 'id, fechaActualizacion, seccion, [seccion+fechaActualizacion]',
  config: 'id',
})
