import Dexie, { type EntityTable } from 'dexie'

// A separate Dexie database, not a table on db.ts's `kurobello` (owned by
// another track this pass must not edit) — a tiny standalone store for one
// signal: "has a Google login ever succeeded on this device." Used to gate
// authStore.restore()'s silent re-auth (specs.md §11, 2026-08-19) so it can
// tell "returning user, safe to restore silently" apart from "first-ever
// visit" or "just locked out, must NOT auto-restore." Not secret — a
// boolean-ish marker, never the token itself — but IndexedDB is still the
// right home for it (never localStorage/sessionStorage, specs.md §7):
// consistency with every other device-local signal in this app, and it
// keeps the marker cleared exactly when `db.vault` next to it would be too
// once resetVault() reaches across (see pinLock.ts).
type MarkerRow = { id: number; loggedInBefore: boolean }

const MARKER_ID = 1 as const

const markerDb = new Dexie('kurobello-device') as Dexie & {
  marker: EntityTable<MarkerRow, 'id'>
}
markerDb.version(1).stores({ marker: 'id' })

export async function hasLoggedInBefore(): Promise<boolean> {
  try {
    return (await markerDb.marker.get(MARKER_ID))?.loggedInBefore ?? false
  } catch (e) {
    // Storage unreadable must degrade to "no marker" — the same posture
    // lockStore.init() takes for hasVault() — so a blocked read here can
    // only ever suppress a silent restore attempt, never block boot.
    console.warn('lock: could not read the login marker, treating as first visit', e)
    return false
  }
}

export async function markLoggedIn(): Promise<void> {
  try {
    await markerDb.marker.put({ id: MARKER_ID, loggedInBefore: true })
  } catch (e) {
    // Best-effort: losing this write just means the next cold start treats
    // the device as a first-ever visit again (no silent restore, an extra
    // explicit login) — annoying, not unsafe.
    console.warn('lock: could not persist the login marker', e)
  }
}

export async function clearLoggedIn(): Promise<void> {
  try {
    await markerDb.marker.delete(MARKER_ID)
  } catch (e) {
    console.warn('lock: could not clear the login marker', e)
  }
}
