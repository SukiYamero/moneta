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
- **A persisted `'connected'` decision now silently re-acquires `drive` on a
  fresh session, not just the decision.** Caught by the operator's review,
  CONFIRMED by tracing the code: `drive` itself is never persisted
  (`specs.md` §4 — derived/session state), and `authenticate()`'s token is
  identity-only (`specs.md` §5, incremental authorization). Before this fix,
  a device that connected yesterday would resolve `driveOptIn: 'connected'`
  on today's cold start while `drive` stayed `null` and the session token
  carried no Drive scope — and, because the whole point of this track is
  that the permission screen stops reappearing, there was no longer any UI
  path back to a working state. `reacquireDriveIfNeeded()` in `authStore.ts`
  closes this: guarded on `drive === null` (not on the decision alone, so a
  mid-session re-lock/unlock — `drive` already populated — never re-runs
  `bootstrap()`), it silently repeats `connectDrive()`'s own
  `requestAccessToken('', DRIVE_SCOPES)` + `bootstrap()` pair (factored out
  as `requestDriveSession()`, shared by both). Same best-effort posture as
  `syncLockedSession`: never throws, never sets `driveError` (that surface
  is for `connectDrive()`'s own user-initiated screen,
  `docs/error-handling.md` §7), and a revoked grant fails silently rather
  than re-prompting (`prompt: ''`, `specs.md` §5) — recoverable later via
  Track G's Profile row. Wired into all three session-landing paths
  (`login`/`restore`/`hydrate`), matching where `resolveDriveOptIn()` already
  runs; each path has a passing/failing test.
- **Clearing: both `authStore.logout()` and `pinLock.resetVault()` clear the
  persisted Drive decision directly**, not just one of them relying on the
  other being called first. See "Spec deltas" for why this is a deliberate
  deviation from the brief's `pinLock.ts` "(import path only)" restriction.
- **The decision is device-scoped, not account-scoped — deliberately, not by
  omission.** It would be possible to key the stored decision by the
  account's email/sub and preserve it across a same-account logout/login on
  the same device, at the cost of also having to compare it against
  whichever account signs in next. Considered and rejected: `logout()`
  cannot know in advance which account (same or different) will sign in
  after it, so an account-keyed store still has to answer "does the next
  login's account match the one this decision was recorded for?" — the
  exact comparison a device-scoped store avoids by clearing unconditionally
  on logout. The cost of getting the comparison wrong is asymmetric: a false
  match hands a different Google account someone else's Drive-connected
  state (silently wrong, security-adjacent); a false non-match just re-asks
  a returning same-account user once (annoying, self-correcting the moment
  they answer). Given the asymmetry, unconditional clearing — the direction
  that can only ever err towards "ask again," never towards "assume
  connected for the wrong account" — is the safer default, and this app
  has no multi-account-on-one-device use case that would justify the added
  complexity of getting the comparison right.

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

## Sweep

**Confirmed clearing sweep (original pass):** `resetVault()`'s only two call
sites (`lockStore.ts`'s lockout branch, `reset()`) both already called
`logout()` immediately after; both now also get direct clearing via
`resetVault()` itself, per the "Spec deltas" §2 reasoning above. Nothing
else in the codebase calls `resetVault()` or a logout-equivalent action.

**Operator review round — additional sweep, "does anything else read
`driveOptIn` as a proxy for Drive being usable":**

```
$ rg "driveOptIn" src --include='*.ts' --include='*.tsx' -l | grep -v '\.test\.'
src/features/auth/RequireAuth.tsx
src/lib/authStore.ts
src/lib/deviceStore.ts
```

- `src/lib/authStore.ts`, `src/lib/deviceStore.ts` — the field's own owner;
  not a "second consumer" in the sense being swept for.
- `src/features/auth/RequireAuth.tsx` — the only outside consumer, and it
  reads `driveOptIn` correctly: `driveOptIn === 'pending'` gates whether to
  show `DrivePermissionScreen`, which is exactly what the field means (has
  this device been asked). It never treats `driveOptIn === 'connected'` as
  "Drive is usable now" — it just stops showing the prompt.

Separately, `rg '\.drive\b' src --include='*.ts' --include='*.tsx' -l | grep -v '\.test\.'`
returns only `src/lib/authStore.ts` itself (the `set({ drive: ... })` call
inside `reacquireDriveIfNeeded`) — confirming `docs/wave-2-plan.md` §3.2:
no Drive-backed `Repo` or any other consumer reads `drive` yet. **Nothing
else found** in either direction. The risk the operator named — Wave 3's
Drive repo reading `driveOptIn === 'connected'` and assuming it can write —
is now closed by construction rather than by discipline: `reacquireDriveIfNeeded`
means `driveOptIn === 'connected'` implies a _best-effort attempt_ to also
have `drive` populated on every fresh session, and `drive !== null` (not
`driveOptIn`) is the field Wave 3 must actually gate writes on. Said
explicitly here so whoever builds `repo.drive.ts` cannot miss it, per the
operator's instruction — this is now load-bearing guidance, not just a
sweep result.

## Open questions for the operator

None blocking. The three items above (RequireAuth's architecture, the
`pinLock.ts` scope deviation, and the device- vs. account-scoping choice)
are all implemented/argued and tested as described, not left half-done —
flagging them because they diverge from the literal brief or because the
reasoning is worth a second pair of eyes, not because they're unresolved.

**Resolved from the operator's review round (2026-08-19):** the
`driveOptIn === 'connected'` / `drive === null` divergence on a persisted
decision was CONFIRMED and fixed via `reacquireDriveIfNeeded()` — see
"Decisions made" above for the fix and "Sweep" above for the follow-up
sweep the operator additionally requested.
