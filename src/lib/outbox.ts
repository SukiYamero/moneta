import { create } from 'zustand'
import type { Config, Movimiento } from '@/lib/schema'
import { db, type ProfileDb } from '@/lib/db'
import { getDeviceId } from '@/lib/deviceStore'
import { createLogicalClock, type Hlc, type LogicalClock } from '@/lib/hlc'
import { getKnownTip } from '@/lib/sync/tip'

export type OutboxOperation =
  | { entity: 'movimiento'; op: 'put'; payload: Movimiento }
  | { entity: 'movimiento'; op: 'del'; payload: { id: string } }
  | { entity: 'config'; op: 'put'; payload: Config }

export interface OutboxEntry {
  id: string
  entity: OutboxOperation['entity']
  entityId: string
  hlc: Hlc
  basedOn: Hlc | null
  device: string
  enqueuedAt: number
  operation: OutboxOperation
}

let entries = db.outbox

export const setOutboxDatabase = (database: ProfileDb): void => {
  entries = database.outbox
  void refreshDirty()
}

const CONFIG_ENTITY_ID = 'config'

const entityIdOf = (operation: OutboxOperation): string =>
  operation.entity === 'config' ? CONFIG_ENTITY_ID : operation.payload.id

let clock: LogicalClock | null = null

const ensureClock = async (): Promise<LogicalClock> => {
  clock ??= createLogicalClock(await getDeviceId())
  return clock
}

const nextHlc = async (): Promise<{ hlc: Hlc; device: string }> => {
  const [c, device] = await Promise.all([ensureClock(), getDeviceId()])
  return { hlc: c.tick(), device }
}

export const observeRemoteHlc = async (remote: Hlc): Promise<void> => {
  const c = await ensureClock()
  c.observe(remote)
}

export const clampOutboxClockToServer = async (serverNowMs: number): Promise<void> => {
  const c = await ensureClock()
  c.clampToServer(serverNowMs)
}

const tableFor = (database?: ProfileDb): typeof entries => database?.outbox ?? entries

const lastHlcFor = async (
  entity: string,
  entityId: string,
  database?: ProfileDb,
): Promise<Hlc | null> => {
  const table = tableFor(database)
  const [ownHistory, pulledTip] = await Promise.all([
    (async (): Promise<Hlc | null> => {
      try {
        const rows = await table.where('[entity+entityId]').equals([entity, entityId]).sortBy('hlc')
        return rows.at(-1)?.hlc ?? null
      } catch (e) {
        console.warn('outbox: could not read prior operations for basedOn, treating as unseen', e)
        return null
      }
    })(),
    getKnownTip(entity, entityId),
  ])
  if (!ownHistory) return pulledTip
  if (!pulledTip) return ownHistory
  return ownHistory > pulledTip ? ownHistory : pulledTip
}

interface OutboxState {
  dirty: boolean
}

export const useOutboxStore = create<OutboxState>(() => ({ dirty: false }))

const refreshDirty = async (): Promise<void> => {
  try {
    const count = await entries.count()
    useOutboxStore.setState({ dirty: count > 0 })
  } catch (e) {
    console.warn('outbox: could not read the pending count', e)
  }
}

void refreshDirty()

export const enqueueOperation = async (
  operation: OutboxOperation,
  database?: ProfileDb,
): Promise<boolean> => {
  const table = tableFor(database)
  const entityId = entityIdOf(operation)
  try {
    const [basedOn, { hlc, device }] = await Promise.all([
      lastHlcFor(operation.entity, entityId, database),
      nextHlc(),
    ])
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      entity: operation.entity,
      entityId,
      hlc,
      basedOn,
      device,
      enqueuedAt: Date.now(),
      operation,
    }
    await table.add(entry)
    if (!database) useOutboxStore.setState({ dirty: true })
    return true
  } catch (e) {
    console.warn('outbox: could not enqueue operation, this device will not sync it', e)
    return false
  }
}

export const listPendingOperations = async (database?: ProfileDb): Promise<OutboxEntry[]> => {
  const table = tableFor(database)
  try {
    return await table.orderBy('hlc').toArray()
  } catch (e) {
    console.warn('outbox: could not read pending operations', e)
    return []
  }
}

export const removeOperations = async (ids: string[], database?: ProfileDb): Promise<void> => {
  const table = tableFor(database)
  try {
    await table.bulkDelete(ids)
  } catch (e) {
    console.warn('outbox: could not clear pushed operations, they will be retried', e)
    return
  }
  await refreshDirty()
}

export const __resetOutboxClockForTests = (): void => {
  clock = null
}

export const __resetOutboxDatabaseForTests = (): void => {
  entries = db.outbox
}
