import Dexie, { type EntityTable } from 'dexie'

// A separate Dexie database, not a table on db.ts's `kurobello` (frozen,
// AGENTS.md) — the canonical home for every device-local, non-secret signal.
// Four live here: "has a Google login ever succeeded on this device" (the
// marker, used to gate authStore.restore()'s silent re-auth, specs.md §11
// 2026-08-19); "has this device already answered the Drive-sync prompt" (the
// decision, specs.md §11 2026-08-19 driveOptIn entry); the offline-window
// anchor (`specs.md` §10.11 — networkStore.ts's own module, `anchor` table
// below); and the device-scoped profile registry (`specs.md` §10.15 —
// profiles/profileRegistry.ts, `profiles` table below). The latter two
// originally shipped as their own separate Dexie databases
// (`kurobello-network`, `kurobello-profiles`) only because the Wave 3
// stage-1 file-ownership table left this file unassigned — folded in here
// once it was back in scope (`specs.md` §11, 2026-08-19); neither had ever
// shipped, so no migration was owed. One device-signal database beats N
// separate ones for what is, in each case, one small table. Not secret, but
// IndexedDB is still the right home (never localStorage/sessionStorage,
// specs.md §7): consistency with every other device-local signal in this app.
type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecision = 'connected' | 'dismissed'
type DriveDecisionRow = { id: number; decision: DriveDecision }
// Kept as plain, locally-scoped row types (not imported from
// networkStore.ts/profiles/profileRegistry.ts) the same way MarkerRow/
// DriveDecisionRow already are — this module stays the generic storage
// layer; the domain-typed public API (`WriteDecision`, `ProfileRecord`, …)
// lives in the modules that own the *meaning* of these rows, not the table
// declaration.
export type AnchorRow = { id: number; lastOnlineAt: number }
export type ProfileRow = {
  id: string
  label: string
  kind: 'local' | 'google'
  databaseName: string
  createdAt: string
  lastUsedAt: string
}

const MARKER_ID = 1 as const
const DRIVE_DECISION_ID = 1 as const

// Storage id frozen (AGENTS.md): renaming it orphans the login marker for
// every existing user and silently forces a re-login. Only the module
// (loginMarker.ts → deviceStore.ts) is renamed here, not the database.
// Exported so tests can inject a storage failure by spying on a table
// method directly — the same seam db.ts's own exported `db` gives
// pinLock.test.ts (fake-indexeddb has no built-in way to simulate this).
// Also exported for networkStore.ts/profiles/profileRegistry.ts to open
// their own tables on this same connection rather than a database of their
// own.
export const deviceDb = new Dexie('kurobello-device') as Dexie & {
  marker: EntityTable<MarkerRow, 'id'>
  driveDecision: EntityTable<DriveDecisionRow, 'id'>
  anchor: EntityTable<AnchorRow, 'id'>
  profiles: EntityTable<ProfileRow, 'id'>
}
deviceDb.version(1).stores({ marker: 'id' })
// Additive: `marker` keeps its v1 definition unchanged — same reasoning as
// db.ts's own version bumps — so an existing device upgrades to v2 without
// losing the marker it already has.
deviceDb.version(2).stores({ marker: 'id', driveDecision: 'id' })
// Additive again: `anchor` (networkStore.ts) and `profiles`
// (profiles/profileRegistry.ts) are new tables with their own index
// requirements (`profiles` needs `kind`/`lastUsedAt` for recency lookups);
// `marker`/`driveDecision` are restated unchanged so an existing v1/v2
// device upgrades to v3 without losing either.
deviceDb.version(3).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
})

export const hasLoggedInBefore = async (): Promise<boolean> => {
  try {
    return (await deviceDb.marker.get(MARKER_ID))?.loggedInBefore ?? false
  } catch (e) {
    // Storage unreadable must degrade to "no marker" — the same posture
    // lockStore.init() takes for hasVault() — so a blocked read here can
    // only ever suppress a silent restore attempt, never block boot.
    console.warn('device: could not read the login marker, treating as first visit', e)
    return false
  }
}

export const markLoggedIn = async (): Promise<void> => {
  try {
    await deviceDb.marker.put({ id: MARKER_ID, loggedInBefore: true })
  } catch (e) {
    // Best-effort: losing this write just means the next cold start treats
    // the device as a first-ever visit again (no silent restore, an extra
    // explicit login) — annoying, not unsafe.
    console.warn('device: could not persist the login marker', e)
  }
}

export const clearLoggedIn = async (): Promise<void> => {
  try {
    await deviceDb.marker.delete(MARKER_ID)
  } catch (e) {
    console.warn('device: could not clear the login marker', e)
  }
}

// Absence means "never asked" — authStore.ts treats a read failure the same
// way (falls back to `undefined`), so a blocked read can only ever re-show
// the Drive-permission screen, never silently skip it.
export const getDriveDecision = async (): Promise<DriveDecision | undefined> => {
  try {
    return (await deviceDb.driveDecision.get(DRIVE_DECISION_ID))?.decision
  } catch (e) {
    console.warn('device: could not read the Drive decision, treating as unanswered', e)
    return undefined
  }
}

export const setDriveDecision = async (decision: DriveDecision): Promise<void> => {
  try {
    await deviceDb.driveDecision.put({ id: DRIVE_DECISION_ID, decision })
  } catch (e) {
    // Best-effort, same posture as markLoggedIn above: losing this write
    // just means the device is asked again next time, not that the
    // connection/dismissal the user just made gets undone.
    console.warn('device: could not persist the Drive decision', e)
  }
}

export const clearDriveDecision = async (): Promise<void> => {
  try {
    await deviceDb.driveDecision.delete(DRIVE_DECISION_ID)
  } catch (e) {
    console.warn('device: could not clear the Drive decision', e)
  }
}
