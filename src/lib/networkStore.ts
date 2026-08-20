import { create } from 'zustand'
import { deviceDb } from '@/lib/deviceStore'

// 7 hours, anchored to the last successful online validation (specs.md
// §10.11, decided 2026-08-19) — not to app launch, and not to the browser's
// online/offline events, which only ever report a *hint* (see below).
export const OFFLINE_WRITE_WINDOW_MS = 7 * 60 * 60_000

const ANCHOR_ID = 1 as const

// Persisted on deviceStore.ts's shared `kurobello-device` connection (its
// `anchor` table), not a database of its own — this originally shipped as a
// separate `kurobello-network` database only because `deviceStore.ts` was
// another in-flight Wave 3 track's file this stage (docs/wave-3-plan.md §2's
// ownership map); folded in once that stopped being true (`specs.md` §11,
// 2026-08-19). Same self-catching-read/write shape deviceStore.ts already
// uses for every device-local, non-secret signal.
const readAnchor = async (): Promise<number | null> => {
  try {
    return (await deviceDb.anchor.get(ANCHOR_ID))?.lastOnlineAt ?? null
  } catch (e) {
    console.warn('network: could not read the last-online anchor, offline window may misfire', e)
    return null
  }
}

const writeAnchor = async (at: number): Promise<void> => {
  try {
    await deviceDb.anchor.put({ id: ANCHOR_ID, lastOnlineAt: at })
  } catch (e) {
    console.warn('network: could not persist the last-online anchor', e)
  }
}

export type MutationKind = 'create' | 'edit' | 'delete' | 'settings'
// Copy for both reasons lives in the i18n table's top-level `errors.offline`
// namespace (`mutationRestricted` / `windowExpired.{title,body}`, all four
// locales) — written this track, not consumed yet: there is no write path
// to surface it from until Track T (stage 2) builds one. Never implies data
// loss (specs.md §10.11): what's on this device stays here either way.
export type WriteRefusalReason = 'offline_mutation_restricted' | 'offline_window_expired'
export type WriteDecision = { allowed: true } | { allowed: false; reason: WriteRefusalReason }

// Reconciled 2026-08-19 (specs.md §11, same date): deleting is now allowed
// offline too, superseding half of §10.11's original restriction. An
// operation log gives every mutation an automatic merge answer, and for a
// delete it's unambiguous because a delete is terminal — two devices
// deleting the same movement offline converge the same way two devices
// creating different movements already did. Editing stays online-only:
// record-level last-write-wins can still silently drop one of two
// concurrent field edits, and field-level merging isn't worth building yet.
// So this table is a live connectivity gate, independent of the 7-hour
// window below — it blocks edit/settings the instant we're offline, but
// never create or delete.
const MUTATION_ALLOWED_OFFLINE: Record<MutationKind, boolean> = {
  create: true,
  edit: false,
  delete: true,
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
    // The window applies equally to create and delete — both are the
    // mutations MUTATION_ALLOWED_OFFLINE lets through, and the window's own
    // reasoning (how long a device may act on stale session validity before
    // being asked to reconnect) was never specific to "append"; it happened
    // to only ever gate create because create was the only one allowed
    // offline before the 2026-08-19 delete reconciliation above.
    // Fail open on an unknown anchor (docs/error-handling.md's fail-open/
    // fail-closed test): refusing a brand-new session's first offline
    // write protects nothing, since there is no history yet to protect.
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
