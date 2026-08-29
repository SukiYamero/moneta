# Single-tab guard

## Goal

The app is only usable in one tab at a time, on one browser context. A second
tab opened while the first is running sees a clear "already open" screen
instead of running a second live instance alongside the first.

## Why this exists

`specs.md` §11 flagged that two tabs of the same account can race each
other's Drive writes — `sync/engine.ts`/`driveFiles.ts` guard reentrancy with
module-level in-flight maps, real within one tab, invisible across two. This
task closes that gap with a hard product rule (one tab, period) rather than
a cross-tab coordination protocol for concurrent writes.

## Mechanism

The **Web Locks API** (`navigator.locks`) is scoped per browser storage
partition (origin), shared by every tab of that partition, and is exactly
the primitive this needs — no server, no BroadcastChannel polling required:

1. As early as possible in boot — mounted above the router, ahead of the app
   shell, the same architectural spot as the existing orientation guard
   (`docs/pendientes-usuario.md` item 19) — attempt
   `navigator.locks.request(LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, callback)`.
2. If the callback receives a `null` lock, the lock is already held by
   another tab in this same partition: render the "already open elsewhere"
   screen instead of the app shell, with a retry action that re-attempts
   step 1 (covers "I actually closed the other tab, let me back in").
3. If the lock is granted, hold it for the tab's entire lifetime (the
   callback returns a promise that only resolves on tab teardown) — the
   browser releases it automatically on tab close, navigation away, or
   crash, so a stale hold can't strand a legitimate reopen.
4. **A short grace period before declaring conflict** — retry once after
   ~250–300ms if the first attempt sees the lock unavailable. A hard
   refresh (F5) briefly overlaps the old context releasing the lock with
   the new one requesting it; without this, a plain refresh could
   intermittently and incorrectly show "already open."

## Rules (each one is a bug if violated)

1. The guard applies to every session — guest included — not only
   Drive-synced profiles. The actual data-race this closes is Drive-specific,
   but the one-tab rule is a deliberate, simpler product-wide rule, not a
   conditional one.
2. **Feature-detect `navigator.locks`.** Where it's unsupported, skip
   enforcement entirely and let the app run — never break the app on a
   browser lacking the API over what is otherwise a nice-to-have guard.
3. The "already open" screen is a full-screen state (like the existing
   full-screen download/orientation guards), not a dismissible toast — it
   fully blocks the app shell from mounting underneath it.
4. Never attempt to detect or block a **different browser storage
   partition** running the app (see "Incognito," below) — this is a
   deliberately different case, not an edge case of the same guard.

## Incognito — explicitly not a gap, don't try to close it

Do not build anything to detect "a normal tab and an incognito tab of the
same account both open." Two tabs **within the same incognito session**
share one storage partition exactly like two normal tabs do, so the Web
Locks guard already covers that case for free. A normal tab and an
incognito tab are a **genuinely separate** storage partition from each
other — separate IndexedDB, separate device id
(`deviceStore.ts`'s `getDeviceId()`), no client-side API can see across that
boundary, and none should try (it's a deliberate browser privacy wall, not
an implementation gap). This does not reopen the Drive-write race either:
`specs.md` §10.19's per-device file sharding already treats the incognito
context as one more independent device, exactly like a second physical
phone signed into the same account — safe by the same construction that
already makes ordinary multi-device sync safe. Treat it as "another device,"
not as a bug.

## Implementation notes

- New module, likely `src/lib/singleTabGuard.ts` (the lock request/retry
  logic) plus a small guard component (`src/features/boot/**` or similar,
  next to the existing full-screen boot states) that renders the blocking
  screen or `children`.
- i18n copy for the blocking screen and its retry action — check
  `docs/voice-and-tone.md`.
- A lock name constant scoped to this app only (not shared with any other
  origin's lock namespace, which Web Locks already guarantees per-origin).

## Files this task owns

A new `src/lib/singleTabGuard.ts` (or similar), a new guard component under
`src/features/boot/**`, its mount point (likely `src/App.tsx` or
`main.tsx`, wherever the orientation guard already mounts above the
router), the relevant i18n keys, and its tests. Does not touch
`sync/engine.ts`/`driveFiles.ts` — this task replaces the need for their
in-flight-map reentrancy guards to handle cross-tab cases, it doesn't
modify them.

## Acceptance per rule

1. Manual/regression: opening the app in guest mode in two tabs shows the
   guard on the second tab.
2. Test: mock `navigator.locks` as `undefined` — the guard renders
   `children` unconditionally, never the blocking screen.
3. Manual: the blocking screen covers the full viewport, with no way to
   interact with an app shell behind it.
4. Test: a second lock request from what the test mocks as a different
   "partition" (i.e., simply never invoked — this is enforced by the
   feature itself doing nothing incognito-specific) is not applicable;
   confirm by code review that no fingerprinting/detection logic was added
   for this case, only the plain Web Locks request.
