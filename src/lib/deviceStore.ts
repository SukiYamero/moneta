import Dexie, { type EntityTable } from 'dexie'

// A separate Dexie database, not a table on db.ts's `kurobello` (frozen,
// AGENTS.md) — a tiny standalone store for device-local, non-secret signals.
// Two live here: "has a Google login ever succeeded on this device" (the
// marker, used to gate authStore.restore()'s silent re-auth, specs.md §11
// 2026-08-19) and "has this device already answered the Drive-sync prompt"
// (the decision, specs.md §11 2026-08-19 driveOptIn entry — now superseded,
// see the same-dated entry this track adds). One device-signal module beats
// a third Dexie database for one more boolean-ish row. Not secret, but
// IndexedDB is still the right home (never localStorage/sessionStorage,
// specs.md §7): consistency with every other device-local signal in this app.
type MarkerRow = { id: number; loggedInBefore: boolean }
type DriveDecision = 'connected' | 'dismissed'
type DriveDecisionRow = { id: number; decision: DriveDecision }

const MARKER_ID = 1 as const
const DRIVE_DECISION_ID = 1 as const

// Storage id frozen (AGENTS.md): renaming it orphans the login marker for
// every existing user and silently forces a re-login. Only the module
// (loginMarker.ts → deviceStore.ts) is renamed here, not the database.
// Exported so tests can inject a storage failure by spying on a table
// method directly — the same seam db.ts's own exported `db` gives
// pinLock.test.ts (fake-indexeddb has no built-in way to simulate this).
export const deviceDb = new Dexie('kurobello-device') as Dexie & {
  marker: EntityTable<MarkerRow, 'id'>
  driveDecision: EntityTable<DriveDecisionRow, 'id'>
}
deviceDb.version(1).stores({ marker: 'id' })
// Additive: `marker` keeps its v1 definition unchanged — same reasoning as
// db.ts's own version bumps — so an existing device upgrades to v2 without
// losing the marker it already has.
deviceDb.version(2).stores({ marker: 'id', driveDecision: 'id' })

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
