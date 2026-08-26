import type { Hlc } from '@/lib/hlc'
import { deviceDb } from '@/lib/deviceStore'

const tips = deviceDb.syncTips

const keyFor = (entity: string, entityId: string): string => `${entity}:${entityId}`

export const recordKnownTip = async (entity: string, entityId: string, hlc: Hlc): Promise<void> => {
  try {
    const key = keyFor(entity, entityId)
    const existing = await tips.get(key)
    if (existing && existing.hlc >= hlc) return
    await tips.put({ id: key, hlc })
  } catch (e) {
    console.warn(`sync: could not record the known tip for ${entity}:${entityId}`, e)
  }
}

export const getKnownTip = async (entity: string, entityId: string): Promise<Hlc | null> => {
  try {
    return (await tips.get(keyFor(entity, entityId)))?.hlc ?? null
  } catch (e) {
    console.warn(
      `sync: could not read the known tip for ${entity}:${entityId}, treating as unknown`,
      e,
    )
    return null
  }
}

export const __clearKnownTipsForTests = async (): Promise<void> => {
  await tips.clear()
}
