import { create } from 'zustand'
import Dexie, { type EntityTable } from 'dexie'

// 7 hours, anchored to the last successful online validation (specs.md
// §10.11, decided 2026-08-19) — not to app launch, and not to the browser's
// online/offline events, which only ever report a *hint* (see below).
export const OFFLINE_WRITE_WINDOW_MS = 7 * 60 * 60_000

type AnchorRow = { id: number; lastOnlineAt: number }
const ANCHOR_ID = 1 as const

// A dedicated database, not a new table on deviceStore.ts's
// `kurobello-device` — that file belongs to another in-flight Wave 3 track
// this stage (docs/wave-3-plan.md §2's ownership map), so it is off limits
// here even though it is the more natural home for one more device-local
// signal. Same "kurobello-<suffix>" naming the frozen-identifiers rule
// already uses (AGENTS.md), and the same self-catching-read/write shape
// deviceStore.ts established for a device-local, non-secret signal.
const networkDb = new Dexie('kurobello-network') as Dexie & {
  anchor: EntityTable<AnchorRow, 'id'>
}
networkDb.version(1).stores({ anchor: 'id' })

const readAnchor = async (): Promise<number | null> => {
  try {
    return (await networkDb.anchor.get(ANCHOR_ID))?.lastOnlineAt ?? null
  } catch (e) {
    console.warn('network: could not read the last-online anchor, offline window may misfire', e)
    return null
  }
}

const writeAnchor = async (at: number): Promise<void> => {
  try {
    await networkDb.anchor.put({ id: ANCHOR_ID, lastOnlineAt: at })
  } catch (e) {
    console.warn('network: could not persist the last-online anchor', e)
  }
}

export type MutationKind = 'create' | 'edit' | 'delete' | 'settings'
export type WriteRefusalReason = 'offline_mutation_restricted' | 'offline_window_expired'
export type WriteDecision = { allowed: true } | { allowed: false; reason: WriteRefusalReason }

// Appends commute, mutations don't: two devices creating movements offline
// merge cleanly because every id is a crypto.randomUUID(); two devices
// editing or deleting the same movement produce a genuine conflict with no
// correct automatic answer (specs.md §10.11). So this table is a live
// connectivity gate, independent of the 7-hour window below — it blocks
// edit/delete/settings the instant we're offline, but never create.
const MUTATION_ALLOWED_OFFLINE: Record<MutationKind, boolean> = {
  create: true,
  edit: false,
  delete: false,
  settings: false,
}

type NetworkState = {
  // A hint, not a fact: navigator.onLine (and the online/offline events
  // that mirror it) reports true on a connected-but-dead network — a
  // captive portal, a dead uplink — so nothing here may treat `online: true`
  // alone as proof of anything. `setOnline` is what the browser events
  // drive; `reportOnlineSuccess`/`reportOnlineFailure` are what a real
  // network attempt elsewhere in the app drives, and are the only two calls
  // allowed to move `lastOnlineAt`.
  online: boolean
  // The offline-window anchor: the last time some real network operation
  // actually succeeded, persisted so a cold boot doesn't reset it to "just
  // validated" (docs/wave-3-plan.md §2.2(2) — the single easiest thing to
  // get wrong here). `null` means "never validated yet, or the persisted
  // value hasn't hydrated from storage" — canWrite() treats that as
  // not-yet-expired, not as expired (see canWrite's own comment).
  lastOnlineAt: number | null
  setOnline: (online: boolean) => void
  reportOnlineSuccess: (at?: number) => void
  reportOnlineFailure: () => void
  canWrite: (kind: MutationKind, now?: number) => WriteDecision
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastOnlineAt: null,
  setOnline: (online) => set({ online }),
  // Called by anything that just completed a real network round trip
  // successfully (authStore's Google calls, for now). Unlike setOnline,
  // this is trusted evidence, so it both clears the hint's doubt and moves
  // the window's anchor.
  reportOnlineSuccess: (at = Date.now()) => {
    set({ online: true, lastOnlineAt: at })
    void writeAnchor(at)
  },
  // A failed request is real evidence too, in the one direction
  // navigator.onLine can't be trusted for — it downgrades the hint, but
  // never rewinds the anchor: a failure doesn't erase the last time things
  // did work.
  reportOnlineFailure: () => set({ online: false }),
  canWrite: (kind, now = Date.now()) => {
    const { online, lastOnlineAt } = get()
    if (online) return { allowed: true }
    if (!MUTATION_ALLOWED_OFFLINE[kind]) {
      return { allowed: false, reason: 'offline_mutation_restricted' }
    }
    // Fail open on an unknown anchor (docs/error-handling.md's fail-open/
    // fail-closed test): refusing a brand-new session's first offline
    // create protects nothing, since there is no history yet to protect.
    if (lastOnlineAt !== null && now - lastOnlineAt > OFFLINE_WRITE_WINDOW_MS) {
      return { allowed: false, reason: 'offline_window_expired' }
    }
    return { allowed: true }
  },
}))

let listenersAttached = false

// Self-initialising per docs/wave-3-plan.md §2.1(2): src/main.tsx belongs to
// another in-flight track this stage, so this module attaches its own
// online/offline listeners on first import instead of waiting for a
// bootstrap call there. Guarded for a non-window environment (a test module
// graph without jsdom) and idempotent — importing this module more than
// once reuses the same listeners.
const initNetworkListeners = (): void => {
  if (listenersAttached || typeof window === 'undefined') return
  listenersAttached = true
  window.addEventListener('online', () => useNetworkStore.getState().setOnline(true))
  window.addEventListener('offline', () => useNetworkStore.getState().setOnline(false))
}

initNetworkListeners()

// Hydrates the persisted anchor once, at module load, so a returning user's
// offline window survives the cold boot that created this store instance
// (docs/wave-3-plan.md §2.2(2)). Best-effort: readAnchor() already
// self-catches, so a storage failure here just leaves lastOnlineAt at its
// fail-open `null` default instead of blocking module init.
void readAnchor().then((lastOnlineAt) => {
  if (lastOnlineAt !== null) useNetworkStore.setState({ lastOnlineAt })
})

// Test-only escape hatch, matching repo.local.ts's __resetReadyMemoForTests:
// production code never calls this. Resets in-memory state only — it does
// not touch the persisted anchor, so a test asserting hydration behavior
// should mock/clear networkDb itself, not rely on this.
export const __resetNetworkStoreForTests = (): void => {
  listenersAttached = false
  useNetworkStore.setState({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastOnlineAt: null,
  })
}
