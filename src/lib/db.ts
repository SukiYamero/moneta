import Dexie, { type EntityTable } from 'dexie'
import type { Activo, Config, Movimiento } from '@/lib/schema'
import type { OutboxEntry } from '@/lib/outbox'

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

export type ConfigRow = Config & { id: number }

export type ProfileOwnerRow = {
  id: number
  kind: 'local' | 'google'
  accountKey?: string
  createdAt: string
}

export type ProfileDb = Dexie & {
  vault: EntityTable<VaultRow, 'id'>
  movimientos: EntityTable<Movimiento, 'id'>
  activos: EntityTable<Activo, 'id'>
  config: EntityTable<ConfigRow, 'id'>
  outbox: EntityTable<OutboxEntry, 'id'>
  profileOwner: EntityTable<ProfileOwnerRow, 'id'>
}

export const createProfileDb = (name: string): ProfileDb => {
  const database = new Dexie(name) as ProfileDb

  database.version(1).stores({ vault: 'id' })

  database.version(2).stores({
    vault: 'id',
    movimientos:
      'id, fecha, seccion, [seccion+fecha], [fecha+createdAt], [seccion+fecha+createdAt]',
    activos:
      'id, fechaActualizacion, seccion, [seccion+fechaActualizacion], [fechaActualizacion+id], [seccion+fechaActualizacion+id]',
    config: 'id',
  })

  database.version(3).stores({
    vault: 'id',
    movimientos:
      'id, fecha, seccion, [seccion+fecha], [fecha+createdAt], [seccion+fecha+createdAt]',
    activos:
      'id, fechaActualizacion, seccion, [seccion+fechaActualizacion], [fechaActualizacion+id], [seccion+fechaActualizacion+id]',
    config: 'id',
    outbox: 'id, hlc, [entity+entityId]',
  })

  database.version(4).stores({
    vault: 'id',
    movimientos:
      'id, fecha, seccion, [seccion+fecha], [fecha+createdAt], [seccion+fecha+createdAt]',
    activos:
      'id, fechaActualizacion, seccion, [seccion+fechaActualizacion], [fechaActualizacion+id], [seccion+fechaActualizacion+id]',
    config: 'id',
    outbox: 'id, hlc, [entity+entityId]',
    profileOwner: 'id',
  })

  return database
}

export const db = createProfileDb('kurobello')
