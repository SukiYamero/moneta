import { findFile } from '@/lib/drive'
import { getDeviceId } from '@/lib/deviceStore'
import { detectLocale } from '@/lib/i18n/detectLocale'
import { enqueueOperation, listPendingOperations } from '@/lib/outbox'
import { buildSeedConfig } from '@/lib/seedConfig'
import { ensureFolder, FOLDER_NAME, writeLeeme } from '@/lib/sync/driveFiles'
import { buildConfigFilename } from '@/lib/sync/opLog'

export { FOLDER_NAME }

// specs.md §4/§10.19: the fixed three-file layout (movimientos.json,
// activos.json, config.json) is superseded by the per-device op-log files.
// Bootstrap no longer pre-creates any of them — a device's own shard/
// config file is created lazily by the sync engine's normal push path
// (sync/engine.ts), the first time it actually has something to push,
// per "exactly one device ever writes any given file." What bootstrap
// still owns: the folder itself, LEEME.txt (rewritten on every connect —
// cheap and idempotent, and the one file every version bump must keep
// current), and making sure a genuinely first-ever connection ends up with
// *something* in appDataFolder (see `ensureSeedConfigQueued` below).
export type DriveLayout = {
  folderId: string
}

export const bootstrap = async (token: string): Promise<DriveLayout> => {
  const folderId = await ensureFolder(token)
  await writeLeeme(token, folderId, detectLocale())
  await ensureSeedConfigQueued(token)
  return { folderId }
}

/**
 * This device's own `config-<device>.json` is normally created lazily by
 * the sync engine's push path — but a brand-new profile's local config is
 * already seeded by `repo.local.ts`'s `ready()` purely locally (never
 * enqueued, since that seeding predates sync and isn't a user action). Left
 * alone, a *second* device later linking the same account would find
 * nothing in `appDataFolder` and independently seed its own
 * region-derived default (specs.md §10.7) — same account, two devices,
 * two different starting currencies. So bootstrap enqueues one config `put`
 * for a device that has never pushed one, letting the ordinary push path
 * carry it to Drive like any other write. Idempotent two ways: a no-op if
 * this device's config file already exists on Drive, and a no-op if one is
 * already queued locally — a retried `connectDrive()`/`reacquireDrive()`
 * must never enqueue a second seed.
 */
const ensureSeedConfigQueued = async (token: string): Promise<void> => {
  const device = await getDeviceId()
  const alreadyOnDrive = await findFile(token, {
    name: buildConfigFilename(device),
    space: 'appDataFolder',
  })
  if (alreadyOnDrive) return

  const pending = await listPendingOperations()
  if (pending.some((entry) => entry.entity === 'config')) return

  await enqueueOperation({ entity: 'config', op: 'put', payload: buildSeedConfig() })
}
