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
// Kept in sync with `profiles/profileRegistry.ts`'s `ProfileRecord` field
// for field (that module owns what each one *means*; this is just the
// persisted shape) — `accountKey` was already additive here only by luck of
// `put()`'s structural typing accepting a superset; an `update()` call with
// an object *literal* (profileRegistry.ts's new watermark setters) doesn't
// get that same leniency, so the row type has to actually declare every
// field a literal update might set.
export type ProfileRow = {
  id: string
  label: string
  kind: 'local' | 'google'
  databaseName: string
  createdAt: string
  lastUsedAt: string
  accountKey?: string
  driveFolderId?: string
  lastPushAt?: string
  lastPullAt?: string
}
// Short and filename-safe on purpose (specs.md §10.19: `mov-<device>-<YYYY-MM>.json`).
export type DeviceIdRow = { id: number; value: string }
// `sync/tip.ts`'s cache of "the last hlc this device knows about, per
// entity" — a transport-layer cache (what pull last merged), never
// `schema.ts` data, so it belongs beside every other device-local signal in
// this database rather than on a profile's own db.ts connection. `id` is
// `${entity}:${entityId}` (e.g. `movimiento:3f9c…`, or the fixed
// `config:config` for the whole-Config entity — specs.md §12's known gap).
export type SyncTipRow = { id: string; hlc: string }
// `sync/engine.ts`'s cache of a previously-downloaded op file, keyed by
// Drive fileId. `file` is `unknown` here deliberately (this module doesn't
// know opLog.ts's types, same posture as every other row above) — but it is
// NOT untrusted input the way a fresh download is: by the time anything is
// written here it has already passed validate.ts once, so a cache *read* is
// trusted, self-produced data, never re-validated. `file: null` is a cached
// negative — a file that failed validation last time, kept so a
// permanently malformed file isn't re-downloaded every single pull, while
// its `modifiedTime` still lets a later fix be noticed.
// `skipped` rides alongside the cached file (specs.md §12, 2026-08-20): a
// cache hit skips re-downloading, but must still be able to report how many
// entries validate.ts dropped from this file the one time it was parsed —
// additive to the row's value shape, no version bump (only the primary key
// is part of the store's schema).
export type SyncFileCacheRow = { id: string; modifiedTime: string; file: unknown; skipped: number }
// A guest's session-less biometric lock (specs.md §10.2.1, Track AF Wave
// 4.1 half 2): unlike `db.ts`'s `LockVault`, there is no DEK/token to wrap
// here — no session means nothing to encrypt — so this is device-scoped,
// not per-profile, and lives beside every other device-local signal in this
// database rather than growing a second vault shape in `db.ts`.
// `credentialId` is the WebAuthn credential's raw id, kept only to target
// the right assertion on `navigator.credentials.get()`; `lastActiveAt`
// mirrors `LockVault.lastActiveAt`'s role for the account path's 7-minute
// background-timeout re-lock (`pinLock.ts`'s `BACKGROUND_TIMEOUT_MS`).
export type GuestLockRow = { id: number; credentialId: Uint8Array; lastActiveAt: number }
// The second half of "has this device been used before" (specs.md §10.33):
// a device-local signal, independent of the login marker, recording only
// that a guest entered the app here, never anything about a person.
// Presence-only, like driveDecision/guestLock's own rows — there is exactly
// one state to record, so no boolean field is needed the way `marker`
// carries `loggedInBefore` (which distinguishes "never checked" from
// "checked and false", a distinction this signal doesn't have).
export type GuestMarkerRow = { id: number }
// The explicit active-profile pointer (specs.md §10.31 §1) — set only by a
// deliberate choice (signing in, entering guest mode, the switcher), read
// by `profiles/profileRegistry.ts`'s `getActiveProfile()` before it falls
// back to its old recency-only resolution. Kept as its own table rather
// than folded onto `ProfileRow` — this is a device-wide fact ("which
// profile"), not a per-profile one.
export type ActiveProfileRow = { id: number; profileId: string }
// A guest's device-wide "bring this local data into the account I just
// signed into?" answer (specs.md §10.32). Presence-only, like
// `driveDecision`/`guestMarker`'s own rows: there is exactly one state
// worth remembering — a decline — since "nothing local to bring" already
// suppresses the prompt on its own (`adoption.ts`'s own count check), and
// an accepted adoption empties the local profile, which does the same.
export type AdoptionDeclinedRow = { id: number }

const MARKER_ID = 1 as const
const GUEST_MARKER_ID = 1 as const
const DRIVE_DECISION_ID = 1 as const
const ADOPTION_DECLINED_ID = 1 as const
const DEVICE_ID_ROW = 1 as const
const DEVICE_ID_LENGTH = 8
const DEVICE_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

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
  deviceId: EntityTable<DeviceIdRow, 'id'>
  syncTips: EntityTable<SyncTipRow, 'id'>
  syncFileCache: EntityTable<SyncFileCacheRow, 'id'>
  guestLock: EntityTable<GuestLockRow, 'id'>
  guestMarker: EntityTable<GuestMarkerRow, 'id'>
  activeProfile: EntityTable<ActiveProfileRow, 'id'>
  adoptionDeclined: EntityTable<AdoptionDeclinedRow, 'id'>
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
// Additive again: `deviceId` (this module, `specs.md` §10.19/§10.13) — the
// short id every op envelope and Drive filename this device produces will
// carry. Every earlier table restated unchanged.
deviceDb.version(4).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
})
// Additive again: `syncTips` (`sync/tip.ts`) — closes a real gap found while
// building replay (specs.md §11, 2026-08-19): `outbox.ts`'s `basedOn`
// originally only ever looked at this device's own outbox history, so a
// device that pulled a newer version from Drive and then deleted it locally
// would stamp a stale `basedOn`, causing a false "concurrent delete-vs-edit"
// revival on the next merge. This table is what a pull writes to and what
// `outbox.ts` now also reads, so `basedOn` reflects the best of both: this
// device's own not-yet-pushed history AND what its last pull actually
// taught it. Every earlier table restated unchanged.
deviceDb.version(5).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
})
// Additive again: `syncFileCache` (`sync/engine.ts`) — the raw per-file
// cache that makes the files.list revision check (specs.md §10.19:
// "download only the files whose modifiedTime moved") actually safe rather
// than merely faster. `Movimiento` deliberately carries no hlc/provenance
// (schema.ts is frozen against it), so skipping a re-download of an
// unchanged file would silently drop its ops from every future replay if
// nothing else remembered their content — this table is that memory. A
// transport-layer cache (what a past pull downloaded), not app data, so it
// belongs beside every other device-local signal here rather than on a
// profile's own db.ts connection. Every earlier table restated unchanged.
deviceDb.version(6).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
  syncFileCache: 'id',
})
// Additive again: `guestLock` (this module, `specs.md` §10.2.1) — a guest's
// session-less biometric lock enrollment. Every earlier table restated
// unchanged.
deviceDb.version(7).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
  syncFileCache: 'id',
  guestLock: 'id',
})
// Additive again: `guestMarker` (this module, `specs.md` §10.33) — "this
// device last used the app as a guest," so a returning guest is
// recognised the same way a returning account holder already is. Every
// earlier table restated unchanged.
deviceDb.version(8).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
  syncFileCache: 'id',
  guestLock: 'id',
  guestMarker: 'id',
})
// Additive again: `activeProfile` (specs.md §10.31 §1, this module's own
// `ActiveProfileRow` comment) and `adoptionDeclined` (specs.md §10.32).
// Every earlier table restated unchanged.
deviceDb.version(9).stores({
  marker: 'id',
  driveDecision: 'id',
  anchor: 'id',
  profiles: 'id, kind, lastUsedAt',
  deviceId: 'id',
  syncTips: 'id',
  syncFileCache: 'id',
  guestLock: 'id',
  guestMarker: 'id',
  activeProfile: 'id',
  adoptionDeclined: 'id',
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

// The guest counterpart to the three functions above (specs.md §10.33):
// presence of the row is the whole signal, so a read failure and "never
// used guest mode" both degrade to `false` the same way hasLoggedInBefore
// degrades to "no marker" — a blocked read can only ever suppress the
// returning-guest path, never fabricate one.
export const hasUsedGuestBefore = async (): Promise<boolean> => {
  try {
    return (await deviceDb.guestMarker.get(GUEST_MARKER_ID)) !== undefined
  } catch (e) {
    console.warn('device: could not read the guest marker, treating as never used', e)
    return false
  }
}

export const markGuestUsed = async (): Promise<void> => {
  try {
    await deviceDb.guestMarker.put({ id: GUEST_MARKER_ID })
  } catch (e) {
    // Best-effort, same posture as markLoggedIn: losing this write just
    // means the next cold start treats this device as never having used
    // guest mode, landing on WelcomeScreen again rather than silently
    // misrepresenting anything.
    console.warn('device: could not persist the guest marker', e)
  }
}

export const clearGuestUsed = async (): Promise<void> => {
  try {
    await deviceDb.guestMarker.delete(GUEST_MARKER_ID)
  } catch (e) {
    console.warn('device: could not clear the guest marker', e)
  }
}

// specs.md §10.32: the device-wide "asked once" answer for the guest-data
// adoption prompt. Absence means "never declined" — a device that has never
// been asked, and one that was asked and said yes, are indistinguishable
// here on purpose: `adoption.ts`'s own count check already suppresses the
// prompt once there is nothing local left to bring, so this row only ever
// needs to remember the one answer that *doesn't* empty the local profile.
export const hasDeclinedAdoption = async (): Promise<boolean> => {
  try {
    return (await deviceDb.adoptionDeclined.get(ADOPTION_DECLINED_ID)) !== undefined
  } catch (e) {
    console.warn('device: could not read the adoption decision, treating as never declined', e)
    return false
  }
}

export const markAdoptionDeclined = async (): Promise<void> => {
  try {
    await deviceDb.adoptionDeclined.put({ id: ADOPTION_DECLINED_ID })
  } catch (e) {
    // Best-effort, same posture as markGuestUsed: losing this write just
    // means the prompt can reappear on a later sign-in, not that anything
    // already declined gets silently undone.
    console.warn('device: could not persist the adoption decision', e)
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

const generateDeviceId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(DEVICE_ID_LENGTH))
  return Array.from(bytes, (b) => DEVICE_ID_ALPHABET[b % DEVICE_ID_ALPHABET.length]).join('')
}

const resolveDeviceId = async (): Promise<string> => {
  try {
    const existing = await deviceDb.deviceId.get(DEVICE_ID_ROW)
    if (existing) return existing.value
  } catch (e) {
    console.warn('device: could not read the device id, minting a fresh one', e)
  }
  const value = generateDeviceId()
  try {
    await deviceDb.deviceId.put({ id: DEVICE_ID_ROW, value })
  } catch (e) {
    // A device that can't persist its id still gets a correct id for this
    // session's own ops — they still merge fine downstream — it just won't
    // be the *same* id next session, splitting this device's Drive shards
    // across an extra id. Never a reason to block a write over it.
    console.warn('device: could not persist the device id, using an ephemeral one this session', e)
  }
  return value
}

let deviceIdPromise: Promise<string> | null = null

// Cached for the process lifetime — minted once, reused by every caller in
// this session (`hlc.ts`/`outbox.ts`), never re-derived per call.
export const getDeviceId = (): Promise<string> => {
  deviceIdPromise ??= resolveDeviceId()
  return deviceIdPromise
}

// Test-only: forces the next getDeviceId() call to re-resolve instead of
// reusing the cached promise, matching networkStore.ts's own reset hatch.
export const __resetDeviceIdForTests = (): void => {
  deviceIdPromise = null
}

// Exported (unlike the other row-id consts above) so pinLock.ts's
// isGuestLockBackgroundExpired can read `deviceDb.guestLock` directly,
// unguarded — same reason isBackgroundExpired reads db.vault.get(VAULT_ID)
// directly rather than through a self-catching wrapper: a storage failure
// there must propagate so lockStore.onVisible can fail closed (re-lock)
// instead of a lower layer silently swallowing it into "not expired".
export const GUEST_LOCK_ID = 1 as const

// Absence means "never enrolled" — same posture as getDriveDecision above.
export const getGuestLock = async (): Promise<GuestLockRow | undefined> => {
  try {
    return await deviceDb.guestLock.get(GUEST_LOCK_ID)
  } catch (e) {
    console.warn('device: could not read the guest lock, treating as not enrolled', e)
    return undefined
  }
}

export const setGuestLock = async (row: Omit<GuestLockRow, 'id'>): Promise<void> => {
  try {
    await deviceDb.guestLock.put({ id: GUEST_LOCK_ID, ...row })
  } catch (e) {
    console.warn('device: could not persist the guest lock', e)
  }
}

export const clearGuestLock = async (): Promise<void> => {
  try {
    await deviceDb.guestLock.delete(GUEST_LOCK_ID)
  } catch (e) {
    console.warn('device: could not clear the guest lock', e)
  }
}

// Best-effort touch, mirrors `pinLock.ts`'s `markActive` for the account
// vault's `lastActiveAt` — a missed write just means the next background-
// expiry check compares against a slightly stale timestamp.
export const touchGuestLockActive = async (now: number = Date.now()): Promise<void> => {
  try {
    await deviceDb.guestLock.update(GUEST_LOCK_ID, { lastActiveAt: now })
  } catch (e) {
    console.warn('device: could not record the guest lock last-active time', e)
  }
}
