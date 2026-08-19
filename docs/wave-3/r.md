# Track R — report

## What was built, and why

**`src/lib/networkStore.ts` (new).** A small zustand store owning the
online/offline hint and the 7-hour offline write window. Self-initialises at
module scope (`window.addEventListener('online'/'offline', …)`, guarded for a
non-`window` environment, idempotent) since `src/main.tsx` belongs to Track W
this stage. The window's anchor (`lastOnlineAt`) is persisted in a new,
dedicated Dexie database, `kurobello-network` — **not** a table added to
`deviceStore.ts`'s `kurobello-device`, even though that file's own comment
argues for exactly that ("one device-signal module beats a third Dexie
database"). `deviceStore.ts` is not in Track R's file-ownership row
(`docs/wave-3-plan.md` §2), so editing it would be writing a file I don't own.
A new, separately-named database is the conflict-free path and still follows
the frozen-identifiers convention (`kurobello-<suffix>`).

Three setters, deliberately not one: `setOnline(bool)` (driven by the browser
events — a hint only), `reportOnlineSuccess(at?)` (called by a real network
success; the only thing that moves the anchor), `reportOnlineFailure()`
(called by a real network failure; downgrades the hint but never rewinds the
anchor). Collapsing these into one `markOnline(bool)` was the obvious first
design and is wrong: the browser's own `online` event is exactly the
unreliable signal §10.11 warns about (fires true on a captive portal),
so it must never be allowed to reset the window's anchor — only a _confirmed_
success may.

`canWrite(kind, now?)` is the single "may this write proceed?" answer,
encoding both halves of the offline write policy: a live-connectivity gate
(edit/delete/settings refused offline, create always allowed — "appends
commute, mutations don't," preserved verbatim near the table) and,
independently, the 7-hour window (blocks even `create` once expired). An
unknown anchor (`null` — never validated, or not yet hydrated from storage)
**fails open**, per the same reasoning `lockStore.init()` already uses for an
unreadable `hasVault()`: refusing a brand-new session's first offline create
protects nothing.

**`authStore.restore()` fixed.** Now checks `networkStore.online` _before_
attempting `authenticate('')` at all. If offline and the device has logged in
before, it authenticates directly from the device marker — `session`/`user`
both `null`, since this is the no-lock path and there is no vault to decrypt
anything from. `status === 'authenticated'` with `session: null` is a new,
real, distinct case (documented on the `AuthState.session` field) — swept
every external consumer of `authStore.session`/`.user` and found none outside
`authStore.ts`/`lockStore.ts` (both already null-tolerant), plus
`HomeHeader.tsx`'s existing `userName ?? ''` fallback, which already handles
this correctly for the guest case and needed no change.

**`authStore.hydrate()` fixed.** Signature is now
`hydrate(session, cachedUser)`. It sets `status: 'authenticated'`
synchronously from the vault-decrypted `session`/`cachedUser` — no `await`
on anything network-shaped before that `set()`. `fetchGoogleUser()` runs
fire-and-forget afterward as a pure refresh: success updates `user` and
re-caches it in the vault; failure is swallowed (logged only if it's _not_
network-shaped — see below) and never touches `status`. Nothing left in the
function's synchronous body can throw (`resolveDriveOptIn`/
`syncLockedSession` both self-catch already), so the `try/catch` that used to
wrap this whole function is gone.

**Vault gains a versioned profile envelope (`pinLock.ts`).** The plaintext
inside `tokenCipher` is now `{ v: 2, session, user }`, decoded
backward-compatibly: `decodeVaultPayload` structurally sniffs for the `v: 2`
discriminant rather than trusting `vault.schemaVersion`, so a pre-existing
vault (bare `AuthSession`, no envelope) still decrypts correctly. Proved with
a dedicated test that builds a real v1 ciphertext via the same WebCrypto
primitives (not through `enableLock`, which only ever writes v2 now).
`unlockWithPin`/`unlockWithBiometric` return `{ session, user }`
(`VaultSession`); `updateSession(session, user)` gained the `user` param
(made required, not optional-defaulting-to-null, so a caller can't
accidentally blow away a cached profile by omission). `db.ts` is untouched —
the vault row's own shape never changed, only what's inside the already-
encrypted bytes.

**`lockStore.resume()`.** No longer possible to reach `SESSION_RESTORE_ERROR`
for "correct PIN, no network" — that's the direct consequence of `hydrate()`
no longer gating on the network at all. The `status !== 'authenticated'`
check stays, now as a defensive invariant rather than a live path (comment
updated to say so), in case `hydrate()` ever grows a real failure mode again.

**Unified error copy.** `src/features/home/errorCopy.ts` moved to
`src/lib/errorCopy.ts` (`homeErrorCopy` → `repoErrorCopyKey`, generic over
any namespace with a matching `error.codes` shape). `SearchScreen.tsx` and
`HistoryScreen.tsx` now render `t(repoErrorCopyKey(error ?? 'unknown'))`
instead of one fixed generic string each; `search.error`/`history.error`
restructured from a flat string into `error.codes.{notFound,schemaMismatch,
invalidInput,network,unknown}` in all four locale files (real per-locale
translations, mirroring `home`'s existing shape).

**Offline write policy.** Shipped as `networkStore.canWrite()` plus its unit
tests only — no write path, per the brief. Track T (stage 2) is the intended
consumer.

**Copy.** New top-level `errors.offline` namespace (`windowExpired.{title,
body}`, `mutationRestricted`) in all four locale files. Never implies data
loss. Not consumed by any UI yet (documented via a comment on
`networkStore.ts`'s `WriteRefusalReason`) — same reason as the write policy
above.

## Backlog items closed

- **`authGeneration` now honoured by `login`/`restore`/`hydrate`**, not just
  `connectDrive`/`reacquireDriveIfNeeded`. Closing this surfaced a real bug I
  introduced and then fixed in the same pass, worth naming explicitly: my
  first draft checked `generation !== authGeneration` immediately after
  `authenticate()` resolved, then did a _second_ `await
resolveDriveOptIn(...)` before the state-committing `set()` — leaving open
  exactly the stale-generation window the check exists to close. Found by
  sweeping the offline branch I'd written the check correctly in against the
  online branches I hadn't. Fixed in both `login()` and `restore()`'s online
  path; pinned with a failing-first regression test (reverted the fix
  locally, watched the new test fail with `status: 'authenticated'` instead
  of `'idle'`, restored the fix, watched it pass).
- **Deliberately not threaded into `syncLockedSession` itself** — the
  backlog item's literal reading includes it as a fifth path. Doing so would
  mean either passing a `generation` snapshot into a function whose only
  side effect is a vault write, or a `shouldProceed: () => boolean`
  predicate parameter — real signature churn for a narrow residual: the
  worst case is one stale vault write of an already-superseded session,
  immediately overwritten by the next real login, no security bypass, no
  data leak beyond what was already true. Documented here as a conscious,
  bounded partial fix rather than silently narrowing scope.
- **`logout()` now re-locks the vault.** `authStore.ts` cannot import
  `lockStore.ts` back (`lockStore.ts` already imports `authStore.ts`; the
  reverse would be a real circular import — the same shape
  `docs/wave-3-plan.md` §2.1(2) forbids for `networkStore`/`main.tsx`).
  Instead, `lockStore.ts` registers a `useAuthStore.subscribe((state,
prevState) => …)` listener at module scope: it fires `lock()` only when
  `status` settles on `'idle'` with `session` newly cleared (was non-null),
  which is the one transition an explicit `logout()` produces and neither of
  `lockStore`'s own two internal `logout()` calls (the lockout branch,
  `reset()`) confuse it with, since both already set their own final phase
  immediately after — the subscription fires harmlessly alongside them and
  converges to the same state. I judge this satisfies "fix it if it doesn't
  create an authStore ↔ lockStore import cycle" (no new `import` edge is
  added; the dependency direction stays lockStore → authStore) rather than
  "report instead of forcing" — flagging the reasoning explicitly since it's
  a judgment call, not a mechanical one.

## Where the brief undersold the work

The brief's item 4 said the lock's error copy "distinguishes wrong-PIN from
no-network," and `docs/wave-3-plan.md` §2.3 said R "adds its one new error
entry" to the lock's hardcoded table. I could not find a real, still-reachable
scenario that needs one. Once `hydrate()` never gates on the network, "correct
PIN, no network" doesn't produce an error at all anymore — it produces a
successful, silent, cache-backed unlock, which is a better outcome than a new
distinguishing error message for a case that used to wrongly error. I looked
for a genuinely new failure mode my own change might have introduced (a
corrupted/legacy vault payload, a `NO_SESSION_ERROR` from the new offline-
restore `session: null` state trying to `enable()` a lock) and concluded both
already resolve correctly through the _existing_ table
(`SESSION_RESTORE_ERROR`/`NO_SESSION_ERROR` respectively) with no new
semantic gap. I did not force a speculative new entry to satisfy the letter
of the brief — this is a place the brief was written before the
implementation detail was known, and the honest update is "closed, not via a
new copy entry."

The other genuinely incomplete piece: **restore()'s offline pre-check has a
residual gap** on a captive portal — `navigator.onLine` (and hence
`networkStore.online`) can report `true` while every real request fails. In
that specific combination (no PIN lock, first restore attempt, captive
portal), `restore()` still attempts `authenticate('')`, it fails, and the
existing (pre-this-track) silent fallback to `'idle'` still applies —
identical to today's behavior, not a regression, just not the literal
"offline entry always works" ideal. I chose not to unconditionally treat
"any `authenticate('')` failure" as "go offline and let the user in," because
that would also swallow a real, non-network failure (e.g. a revoked grant)
and strand a user in a stale offline-authenticated state with no path back to
a real login. `isNetworkShapedAuthFailure` bounds this narrowly on purpose.

## Decisions for specs.md §11

1. **Vault plaintext envelope versioning** (`{ v: 2, session, user }`,
   decoded backward-compatibly by structural sniff, not
   `vault.schemaVersion`). `db.ts`/`LockVault`'s own shape is unchanged.
2. **`AuthState.session === null` while `status === 'authenticated'`** is now
   a real, load-bearing case (the no-lock, offline, returning-user path) —
   not a bug, not a placeholder.
3. **`networkStore`'s anchor lives in its own Dexie database
   (`kurobello-network`)**, not a table on `deviceStore.ts`'s
   `kurobello-device`, specifically because of this stage's file ownership
   split — flagged as a design compromise the operator may want to revisit
   once `deviceStore.ts` is back in a track's active scope (folding the
   table in then would need a small migration: read the old `anchor` table
   once, write into the new location, drop the old database).
4. **`isNetworkShapedAuthFailure`'s classification is deliberately narrow**:
   only `AuthError('GIS failed to load')` and non-`AuthError` throws (a raw
   `fetch()` TypeError) count as network-shaped; `access_denied`/
   `popup_closed`/`popup_failed_to_open`/a `userinfo` HTTP-status failure do
   not. Getting this wrong in either direction is a real regression risk
   (too broad: a captive portal downgrade fires for e.g. a genuinely revoked
   grant; too narrow: a real network failure doesn't update the hint) —
   recorded so it isn't "simplified" to `instanceof AuthError` later without
   re-deriving why.
5. **No new lock error copy entry added** — see "Where the brief undersold
   the work" above.

## Deferred / backlog additions for specs.md §12

- **The captive-portal residual gap in `restore()`** described above. Real,
  narrow, pre-existing in spirit (today's code has the identical gap for
  every `authenticate()` failure, not just this one). Closing it properly
  needs an active connectivity probe (e.g. a lightweight `fetch` to a
  known-reachable endpoint) rather than trusting `navigator.onLine`, which is
  more surface area than this track's blast radius allows.
- **`syncLockedSession` still doesn't check `authGeneration`** — see the
  "backlog items closed" section above for the bounded reasoning. If a
  future track needs airtight guarantees here (not just "eventually
  consistent, superseded by the next real login"), thread a generation
  check into it directly.
- **No active re-validation on the browser's `online` event returning
  mid-session.** `hydrate()`'s fire-and-forget refresh only runs once, at
  unlock time. If the network comes back later in the same session, nothing
  proactively re-validates the cached profile/session — the next real auth
  flow (a future explicit action) will pick up the current state correctly,
  but there's no "quiet revalidation on reconnect" beyond that. Given there's
  no write path yet to make this urgent, I judged building an active listener
  for it out of proportion to this track's blast radius; worth a first-class
  look once Track T's write path exists and staleness has a real cost.
- **The Drive-permission-prompt edge case for the offline-restore path**: a
  device that has logged in before but never answered the Drive prompt
  (`driveOptIn` still `'pending'`), restoring offline, will see
  `DrivePermissionScreen` instead of the dashboard directly (one extra tap —
  "Ahora no" works fine offline). Not a regression (pre-existing behavior for
  any first `driveOptIn` resolution), not explicitly covered by the "Done
  when" criteria, left as is.

## Spec deltas

None — `specs.md` §10.11 held up as written once implemented. The one place
the _plan_ (`docs/wave-3-plan.md`, not the spec) undersold the work is the
"one new lock error entry" item, covered above.

## Open questions for the operator

1. Is the `kurobello-network` new-database choice (item 3 above) acceptable,
   or would you rather I request `deviceStore.ts` ownership from whichever
   track has it and fold the anchor into a real device-signal table? I
   judged the new-database path as clearly better than the alternative
   (waiting/coordinating across tracks for a one-row table), but it's a
   genuine tradeoff worth confirming.
2. Confirm the "no new lock error entry" call (see above) — if there's a
   scenario I'm not seeing that the brief had in mind, point me at it and
   I'll add it.

## Doc lines to add (exact file, exact place, exact text)

**`src/lib/README.md`** — insert a new bullet after the existing
`deviceStore.ts` bullet, before `toastStore.ts`:

```
- `networkStore.ts` — a small, self-initialising zustand store (attaches
  `online`/`offline` listeners at module scope, since `main.tsx` is another
  track's file) owning the online/offline hint plus the 7-hour offline
  write window. The window's anchor (last successful online validation) is
  persisted in its own Dexie database, `kurobello-network`, deliberately
  separate from `deviceStore.ts`'s `kurobello-device` (this track's file
  ownership excluded that file — see `specs.md` §11, 2026-08-19).
  `canWrite(kind, now?)` is the single "may this write proceed?" answer:
  read/create always allowed, edit/delete/settings refused offline
  regardless of the window, create additionally refused past the window.
  Reads no other store.
- `errorCopy.ts` — `RepoErrorCode` → translation key, shared by Home/
  Search/History (moved from `src/features/home/errorCopy.ts`, which was
  never Home-specific — `specs.md` §10.11).
```

**`src/lib/README.md`** — in the existing `authStore.ts` bullet, append this
sentence: "`restore()`/`hydrate()` no longer gate entry on a network call
(specs.md §10.11): a returning user reaches `authenticated` from local
evidence alone (the device's login marker, or the PIN-vault's cached
session/profile) when offline, with `fetchGoogleUser()` running as a
best-effort background refresh, never a blocking gate."

**`src/lib/README.md`** — in the existing `pinLock.ts` bullet, append: "The
vault's plaintext is a versioned envelope (`{ v: 2, session, user }`,
decoded backward-compatibly from the pre-envelope v1 shape) so the cached
Google profile survives a re-lock/cold-boot without a network call."

## `bun run check` output (real, pasted)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-r

 Test Files  76 passed (76)
      Tests  733 passed (733)
   Start at  15:18:22
   Duration  13.57s (transform 2.32s, setup 14.14s, import 39.37s, tests 17.47s, environment 37.77s)
```

The `button.tsx` warning is pre-existing (present at the starting commit,
unrelated to this track — shadcn-generated file, `src/components/ui` is out
of scope per `AGENTS.md`).

Baseline at start of track: 700 tests, all passing. This track added 33 net
tests (networkStore: 12 new; pinLock: +3; authStore: +12; lockStore: +4
net; errorCopy: 5, moved unchanged; HistoryScreen.status/SearchScreen: +3
regression tests for the unified error copy) across 76 files.
