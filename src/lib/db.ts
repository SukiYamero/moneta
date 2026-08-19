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
// Indexes are chosen to serve `ListQuery` (repo.ts §10.3), with a fast,
// bounded-read keyset-pagination path in mind (see repo.local.ts §10.3.1):
//  - `fecha` / `fechaActualizacion`, `seccion`, `[seccion+fecha]` /
//    `[seccion+fechaActualizacion]`: narrowing indexes for the general
//    in-memory fallback path (arbitrary `sortBy`, or `limit` omitted).
//  - `[fecha+createdAt]` / `[fechaActualizacion+id]` and
//    `[seccion+fecha+createdAt]` / `[seccion+fechaActualizacion+id]`: the
//    *ordering* indexes for the fast path. Compounding the date field with
//    the entity's own tiebreak field (`createdAt` for movimientos; `id`
//    itself for activos, which has no separate tiebreak field) means the
//    index's native lexicographic order already IS the full deterministic
//    sort order `list()` needs — a keyset page can be read directly off a
//    bounded `.limit()` cursor instead of materializing and sorting the
//    whole matching set in memory. `createdAt` alone is NOT indexed: it's
//    only ever consulted as part of that compound tiebreak, never queried
//    on its own.
db.version(2).stores({
  vault: 'id',
  movimientos: 'id, fecha, seccion, [seccion+fecha], [fecha+createdAt], [seccion+fecha+createdAt]',
  activos:
    'id, fechaActualizacion, seccion, [seccion+fechaActualizacion], [fechaActualizacion+id], [seccion+fechaActualizacion+id]',
  config: 'id',
})
