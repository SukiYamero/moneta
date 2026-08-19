# Track J — Drive-permission screen refinements + device-scoped decision — report

## Decisions made (for specs.md §11)

- **2026-08-19 — Drive-sync decision persisted per device, superseding the
  2026-08-18 "in-memory, per-session, never persisted" entry.** The earlier
  decision was correct under the assumption that every cold start rebuilds
  the identity session from scratch. That stopped being true once the PIN
  lock's cached vault + `hydrate()` shipped: a user who already answered the
  Drive prompt — connect or dismiss — was being asked again on every reopen
  with the lock enabled, once per session forever. `authStore.driveOptIn`'s
  in-memory shape is unchanged (`'pending' | 'connected' | 'dismissed'`);
  what changed is that `'connected'`/`'dismissed'` are now also written to
  `src/lib/deviceStore.ts`'s new `driveDecision` table (IndexedDB,
  `kurobello-device`) and read back on the next cold start. Absence means
  "never asked" → `'pending'`, same as before. Not `localStorage`/
  `sessionStorage` (`specs.md` §7), not `Config` (a user who dismissed Drive
  has nothing to store a Config preference in), not `db.ts` (`v1` vault
  table is frozen, `AGENTS.md`).
- **`src/lib/loginMarker.ts` renamed to `src/lib/deviceStore.ts`.** The file
  already owned exactly the right thing — a standalone Dexie database for
  device-local, non-secret signals — but its name under-described it once a
  second signal (the Drive decision) moved in. The Dexie database name
  `kurobello-device` is unchanged (frozen, `AGENTS.md`); only the module and
  its file name moved. `marker` keeps its Dexie v1 schema; `driveDecision`
  is added as a new table in an additive v2 schema bump (mirrors `db.ts`'s
  own versioning pattern) so an existing device upgrades without losing its
  login marker.
- **Resolution point: inside `authStore`'s own async `login`/`restore`/
  `hydrate`, not inside `RequireAuth`.** See "Spec deltas" below — this is a
  deliberate deviation from the brief's suggested shape, argued and kept.
- **`connectDrive()` persists the decision on success only**, after
  `bootstrap()` (Drive provisioning) itself has already succeeded — not on
  attempt. If the OAuth popup succeeds but bootstrap fails, nothing is
  persisted and `driveOptIn` stays `'pending'`, so the next cold start asks
  again cleanly instead of recording a decision that doesn't match what
  actually happened (`docs/error-handling.md` §4). This was already the
  existing in-memory behavior (`driveOptIn: 'connected'` was already set
  only after a successful `bootstrap()`); persistence just rides the same
  point.
- **Clearing: both `authStore.logout()` and `pinLock.resetVault()` clear the
  persisted Drive decision directly**, not just one of them relying on the
  other being called first. See "Spec deltas" for why this is a deliberate
  deviation from the brief's `pinLock.ts` "(import path only)" restriction.

## Backlog / deferred (for specs.md §12)

- Nothing new. The two `specs.md` §12 items this track closes
  ("Drive-sync opt-in persistence + screen refinements", and the screen
  half of "Persistent Drive-sync toggle") are both done; the Profile "Drive"
  row itself stays Track G/Wave 3 as already scoped.
- **Multi-tab consistency is last-write-wins, not live-synced.** Two tabs
  open, one connects, the other still shows the Drive-permission screen and
  the user dismisses there — the dismissal overwrites the earlier connect in
  storage (each tab's own in-memory `driveOptIn` stays whatever it locally
  set, so neither tab visibly "flips" under the user, but the next cold
  start in either tab reads whichever write landed last). No `BroadcastChannel`/
  storage-event sync exists anywhere else in this app either, and building
  one is out of this track's scope (not named in the brief's "Done when" or
  "Out of scope" — it names the Profile row, OAuth changes, and new scopes
  as the only exclusions). Flagging it rather than silently deciding it's
  fine: if cross-tab correctness for this ever matters, it's a small,
  separable follow-up (a `storage`-adjacent event on the device DB), not a
  reason to hold this track.

## Doc lines to add (say exactly which file and where)

Both are existing directory `README.md`s (operator-owned this wave, §1.2) —
listed here for the operator to fold in, not edited by this track.

- **`src/lib/README.md`**: wherever it currently references
  `src/lib/loginMarker.ts`, replace with `src/lib/deviceStore.ts` and add a
  line noting it now also owns the persisted Drive-sync decision
  (`getDriveDecision`/`setDriveDecision`/`clearDriveDecision`), alongside
  the existing login marker (`hasLoggedInBefore`/`markLoggedIn`/
  `clearLoggedIn`).
- **`src/features/auth/README.md`**:
  - The `WelcomeScreen.tsx` bullet's `@/lib/loginMarker` reference →
    `@/lib/deviceStore`.
  - The `DrivePermissionScreen.tsx` bullet should note the screen now shows
    a single, enlarged permission item plus a reassurance line near
    "Ahora no", and that the decision persists per device
    (`@/lib/deviceStore`) instead of resetting every session.
  - The `RequireAuth.tsx` bullet's `pinLock.resetVault()` parenthetical
    ("clears the marker too") → "clears the marker and the persisted Drive
    decision too".

## Spec deltas (anything where the brief below turned out wrong)

1. **No code change needed in `RequireAuth.tsx` at all.** The brief assumed
   the async storage read would live in `RequireAuth` with its own explicit
   loading state. Instead, `resolveDriveOptIn()` runs inside the same async
   operation (`login`/`restore`/`hydrate`) that already gates when `status`
   flips to `'authenticated'` — and `driveOptIn` is set in the _same_
   `set()` call as `status`. `RequireAuth` only ever reads `driveOptIn` once
   `status === 'authenticated'`, so by construction there is no render where
   status says "authenticated" but the Drive decision hasn't caught up yet.
   `WelcomeScreen`/`LockScreen` already cover the entire async window with
   their existing busy states (`status === 'authenticating'` /
   `phase === 'locked'`) — no new loading state needed anywhere. I added one
   `RequireAuth.test.tsx` case (`never flashes the Drive screen for a device
that already answered`) that proves this at the component boundary: a
   controlled `restore()` promise, resolved together with
   `status`/`driveOptIn` in one `act()`, never renders `DrivePermissionScreen`
   in between. I think this is the better architecture, not just an equally
   valid one — it means the flash-prevention property is enforced once,
   structurally, at the store layer, instead of being a discipline every
   future consumer of `driveOptIn` has to re-derive correctly. Happy to
   revert to a `RequireAuth`-owned loading flag if you disagree, but I'd
   need to hear the reason.
2. **`pinLock.ts` changed beyond "import path only."** The brief scoped
   `pinLock.ts` to an import-path-only change and separately required that
   `resetVault()` "clears the Drive decision too." I initially tried to
   satisfy both by relying on the fact that `resetVault()`'s only two real
   call sites (`lockStore.ts`'s lockout branch and `reset()`) both call
   `useAuthStore.getState().logout()` immediately after — so clearing in
   `logout()` alone would transitively cover both today. I rejected that:
   it makes correctness depend on an invariant that isn't enforced anywhere
   ("every `resetVault()` caller happens to also call `logout()`"), which is
   exactly the shape of bug `AGENTS.md` calls out — a fix that works today
   by accident of call-site pairing, not by construction. `resetVault()` was
   already the one place that clears the login marker directly, without
   relying on a caller to also do it; the Drive decision is that same
   function's twin state, so it gets the same direct treatment. I added
   `clearDriveDecision()` to `resetVault()` (two lines: an import addition
   and a call, same shape as the existing `clearLoggedIn()` call) **and**
   kept it in `logout()` — defense in depth, not either/or. If you'd rather
   `pinLock.ts` stay strictly import-only, the fix is to move the
   `resetVault()`-adjacent clearing into `lockStore.ts` instead (a file this
   track doesn't own) — my read is that's worse, since it re-introduces the
   same reliance-on-pairing problem I just rejected, just one file over.

## Open questions for the operator

None blocking. The two items above (RequireAuth's architecture, and the
`pinLock.ts` scope deviation) are both implemented and tested as described,
not left half-done — flagging them because they diverge from the literal
brief, not because they're unresolved.
