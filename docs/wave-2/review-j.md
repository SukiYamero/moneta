# Review — Track J (Drive-permission screen refinements + device-scoped consent)

Reviewer pass on `feat/wave2-drive-consent` (`c874163`) + the follow-up fix
`3e936c4`, against `docs/wave-2/track-j.md`'s own claims and the six attack
angles in the review brief.

## Findings, most severe first

### 1. CONFIRMED (reproduced) — `reacquireDriveIfNeeded` had no `authGeneration`

guard; a `logout()` mid-flight resurrected the old account's session/drive.
FIXED, test added.

`connectDrive()` captures `authGeneration` before its async work and checks
it before calling `set()`, specifically to stop a stale in-flight request
from resurrecting state after `logout()`. `reacquireDriveIfNeeded` — new in
this track, sharing `requestDriveSession()` with `connectDrive()` — did not
have this guard at all. Since `login`/`restore`/`hydrate` all flip `status`
to `'authenticated'` _before_ calling `reacquireDriveIfNeeded`, the app is
already interactive while the reacquire's network round trip is still
in-flight, so `logout()` firing during that window is a real, reachable
race, not a theoretical one.

Reproduced with a scratch test before touching any code: `hydrate()` on a
persisted `'connected'` decision, with `requestAccessToken` held pending;
called `logout()` while it was in flight; then resolved the pending token.
Result before the fix: `session`/`drive` came back populated with the
just-logged-out account's data even though `status` stayed `'idle'`.

```
AssertionError: expected { accessToken: 'drive-tok', …(1) } to be null
- Expected: null
+ Received: { "accessToken": "drive-tok", "expiresAt": 2 }
```

Fixed in `src/lib/authStore.ts`'s `reacquireDriveIfNeeded` by capturing
`authGeneration` before `await reacquireDrive()` and checking it before the
`set()` call, same shape as `connectDrive()`. Re-ran the same scenario after
the fix — passes. Permanent regression test added to
`src/lib/authStore.test.ts`: `'a logout() during an in-flight silent
re-acquire does not resurrect session/drive'`.

This is exactly the "same shape, unfixed twin" defect `AGENTS.md` names as
the project's most expensive lesson — `connectDrive()` had the guard,
its literal sibling didn't.

**Not fixed, flagging separately:** the same class of gap exists more
broadly. `login()`/`restore()`/`hydrate()`'s own `set({status:
'authenticated', ...})` calls and the shared `syncLockedSession(session)`
call (used by all four session-landing paths) have **never** checked
`authGeneration`, even before this track — only `connectDrive()` did. That
predates Track J and isn't something its diff introduced, but Track J does
widen the exploitable window: it adds a new network round trip
(`reacquireDriveIfNeeded`) inside the same critical section, meaning
`syncLockedSession` — which caches whatever session variable it's handed
into the PIN vault, not `get().session` — now has more time to run _after_
a mid-flight `logout()` and write a just-logged-out account's token into a
still-live, still-enabled vault. I did not reproduce this one (didn't want
to guess at a fix for a pre-existing, cross-cutting gap not scoped to this
track's files), but the mechanism is concrete enough to write down: a
generation check belongs on every session-landing path, not just
`connectDrive()`, and `authStore.ts` is the only file that could carry it.
Recommend a follow-up item, not a Track J blocker — it's a widened window
on a preexisting gap, not a new one.

### 2. CONFIRMED (traced, not live-reproduced) — the "cannot delay the auth

flow it rides on" posture holds for `login`/`restore` but is violated for
the lock's `resume()`/`hydrate()` path. Not fixed — cross-cutting, outside
my files.

`login()`/`restore()` flip `status` to `'authenticated'` in the same `set()`
that resolves `driveOptIn`, _before_ `reacquireDriveIfNeeded` runs — and
nothing awaits `login()`/`restore()`'s own returned promise for UI purposes
(`RequireAuth` only reads store state), so the reacquire genuinely runs
in the background there. That part of the builder's claim is correct.

`hydrate()`, however, is invoked from `lockStore.ts`'s `resume()` as:

```ts
const session = await unlock()
await useAuthStore.getState().hydrate(session)
if (useAuthStore.getState().status !== 'authenticated') { ... }
set({ phase: 'unlocked', error: null })
```

`resume()` awaits `hydrate()`'s _entire_ promise — including
`reacquireDriveIfNeeded` and `syncLockedSession` inside `hydrate`'s own try
block — before flipping `lockStore.phase` away from `'locked'`. `AppLock`
renders `LockScreen` for as long as `phase === 'locked'`, and `LockScreen`
(a dev/test harness per `specs.md` §12, not owned by this track) has no
busy indicator at all — `void unlockPin(pin)` is fire-and-forget with zero
visual feedback. So on a PIN-lock cold start where a device previously
connected Drive (`driveOptIn === 'connected'`, `drive` starts `null` on
every fresh page load), entering a correct PIN now visibly does nothing
until a full silent-reacquire round trip completes: a GIS silent token
request plus `bootstrap()`'s up to five sequential, un-timed-out Drive API
calls (`src/lib/bootstrap.ts` has no `AbortSignal`/timeout, pre-existing,
same exposure `connectDrive()` already had — but that one has its own
"Conectando…" busy overlay; this automatic path has none anywhere in its
call chain). If the network stalls, the correct-PIN screen looks frozen
indefinitely, with nothing to tell the user whether it's slow or broken.

This is CONFIRMED by tracing every `await` in the chain
(`resume→hydrate→reacquireDriveIfNeeded→reacquireDrive→requestDriveSession→
requestAccessToken+bootstrap`) — none of it is fire-and-forget, so the
delay is not a hypothetical. I did not instrument it with fake timers to
measure duration; the control-flow trace alone is conclusive that the delay
exists, but I can't quantify it against a real Drive API without live
credentials.

`lockStore.test.ts` and `authStore.test.ts` both exercise `hydrate()`, but
never together — `lockStore.test.ts` fully mocks `useAuthStore.hydrate`, so
no existing test can catch (or already caught) this composed delay.

**Why I'm reporting, not fixing:** the fix lives in one of two places
neither of which is mine — either `hydrate()` stops awaiting the reacquire
before resolving (a shape change to what "hydrate resolved" means, which
`resume()`'s `SESSION_RESTORE_ERROR` check also depends on), or
`lockStore.resume()`/`LockScreen` stop awaiting `hydrate()`'s full promise
before unlocking. Both are exactly "changes the auth flow's shape" per my
brief. Flagging for your call.

### 3. Verified, no defect — Dexie v1→v2 upgrade preserves the login marker

Wrote and ran (didn't just assume) a test that seeds a real `kurobello-device`
v1 database (marker only), then dynamically imports the real
`src/lib/deviceStore.ts` module to trigger its v2 upgrade, and confirms the
marker survives and `getDriveDecision()` correctly resolves to `undefined`
(never fabricates an answer) for a device that predates the Drive-decision
table. Passed on the first run — no code defect here, the additive-version
pattern is sound. Kept as a permanent regression test:
`src/lib/deviceStore.upgrade.test.ts` (a separate file, deliberately —
`deviceStore.test.ts`'s own static import already opens the real connection
at v2, which would make seeding a v1-only database impossible in the same
file).

### 4. Verified, no defect — scopes, clearing sweep, no-flash claim, storage

failure posture

- **Scopes.** `src/lib/auth.ts`'s `DRIVE_SCOPES` is untouched by this
  track's diff (confirmed via `git diff` across the whole range — zero
  changes to `auth.ts`/`bootstrap.ts`/`drive.ts`). `requestDriveSession()`
  (shared by `connectDrive()` and the new reacquire path) calls
  `requestAccessToken('', DRIVE_SCOPES)` — the exact same scope string
  `connectDrive()` already used pre-track. No escalation, tested
  (`expect(mToken).toHaveBeenCalledWith('', 'drive-scopes')`).
- **Twin-shape clearing sweep.** Independently re-ran the sweep the builder
  reported: `grep`'d every call site of `resetVault()` and
  `useAuthStore.getState().logout()` across `src/`. Exactly two
  `resetVault()` call sites (`lockStore.ts`'s lockout branch, `reset()`),
  both of which _also_ call `logout()` immediately after. `resetVault()`
  itself now clears `clearLoggedIn()` **and** `clearDriveDecision()`
  directly (not relying on the paired `logout()` call), and `logout()`
  clears it too — genuine defense-in-depth, not reliance on call-site
  pairing. Nothing else found.
- **No-flash claim.** Verified by reading, not just trusting the test: every
  one of `login`/`restore`/`hydrate` resolves `status` and `driveOptIn` in
  the _same_ `set()` object literal — structurally impossible for
  `RequireAuth` to observe one without the other. Tried to break it with
  the five listed scenarios: a slow storage read only delays _entering_
  `'authenticated'` (no intermediate render, since the read happens before
  the `set()`); a storage read that throws degrades to `'pending'` inside
  `resolveDriveOptIn` before that same `set()`, never a partial state; two
  tabs don't share JS module state at all (this is the already-documented,
  deliberately-deferred "last write wins" persistence issue, not a flash);
  `hydrate()` from the lock's resume path has the same one-`set()` shape
  (its _timing_, not its _atomicity_, is finding 2 above); a second account
  logging in after `logout()` reuses the same one-`set()` shape in `login()`
  and I additionally reproduced that `logout()`'s fire-and-forget
  `clearDriveDecision()` is not still-in-flight by the time a fast
  subsequent `getDriveDecision()` read happens (empirical test against real
  Dexie/fake-indexeddb, not just call-order reasoning) — no stale-decision
  leak between accounts.
- **Failure posture.** Every `deviceStore.ts` function self-catches, logs via
  `console.warn`, and degrades to the value that shows the screen again
  rather than assuming an answer (`undefined`/`false`, never a fabricated
  `'connected'`/`'dismissed'`). All six swallow sites have a matching
  "storage read/write fails" test in `deviceStore.test.ts`
  (docs/error-handling.md §2/§8 compliance) — confirmed by reading, these
  predate my pass and are correct as written.

## Framing check

The device-scoped-over-account-scoped decision (track-j.md's reasoning) is
sound: the asymmetry argument (a false account match silently hands over
Drive state to the wrong person; a false non-match just re-asks) is the
right call given this app's no-multi-account-on-one-device scope, and I
didn't find a case that breaks it.

The rename (`loginMarker.ts` → `deviceStore.ts`) is a pure rename plus one
additive table; nothing about it concerns me.

The operator-directed silent re-acquire is the right fix for the gap it
closes (a persisted `'connected'` decision with no way back to a working
Drive session), but finding 2 above means its "never delay" promise was
only verified against half of its actual call graph — the login/restore
path was tested by the builder, the lock's resume path was not, and that's
precisely the path the review brief named as one to check.

## What I need you to decide

1. **Finding 2** (resume-path delay): should `hydrate()` stop awaiting the
   reacquire before resolving, should `lockStore.resume()` stop awaiting
   `hydrate()`'s full promise, or is the added latency acceptable as-is
   until `LockScreen` gets its real busy-state UI (it's a dev harness
   today)? Each option reshapes a piece of the auth flow I don't own alone.
2. **The broader `authGeneration` gap** named at the end of finding 1
   (`login`/`restore`/`hydrate`'s own `set()` calls and
   `syncLockedSession` never check it, only `connectDrive()` does) — worth
   a dedicated follow-up track, given it's pre-existing and cross-cutting
   rather than something this track's diff introduced?

## `bun run check`

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  62 passed (62)
      Tests  578 passed (578)
```

The one warning is a pre-existing shadcn-generated file (`src/components/ui/button.tsx`), outside this track and outside my files — not introduced by this pass.
