# Review — Wave 2.2 · Track Q (guest entry)

Reviewing `86fe8df` (`authStore.ts`, `RequireAuth.tsx`, `WelcomeScreen.tsx`,
the four locale files, and their tests), rebased onto `main` after Track P's
`f78d09e` merged (loading system). Rigor: high — auth store + route guard is
TDD-mandatory territory per `AGENTS.md`.

## Done-when verification (run, not read)

- specs.md §10.10's five "Done when" items, each checked by running the
  relevant test, not by reading the implementation:
  1. First screen offers both paths, divider + spacing —
     `WelcomeScreen.test.tsx` ("offers a guest entry below the Google
     button, behind an 'or' divider") — pass.
  2. Guest enters without seeing the Drive screen —
     `RequireAuth.test.tsx` ("renders children directly for a guest,
     skipping both Welcome and Drive screens") — pass.
  3. Guest distinguishable from an authenticated user in the store —
     `authStore.test.ts`'s `continueAsGuest` block — pass.
  4. Boot doesn't flash the login screen for either path —
     `RequireAuth.test.tsx`'s boot-flash tests plus the two regression
     tests added in this review — pass (see finding 1).
  5. `bun run check` green — see bottom of this file.

## Findings

### 1. CONFIRMED (reproduced with a test) — explicit login() was swallowed by the boot-flash fix

Traced and reproduced. `login()` sets the exact same `status:
'authenticating'` that a cold-boot `restore()` does
(`src/lib/authStore.ts:181`). `RequireAuth`'s guard checked `status ===
'authenticating'` unconditionally and returned the full-screen `BootScreen`
— so the instant a user tapped "Continuar con Google" on an already-visible
`WelcomeScreen`, the whole screen (including its own label-swap busy button,
the legal text, the guest option) was torn out and replaced by a full-screen
spinner for the duration of the login round-trip. That's a direct violation
of specs.md §10.9 tier 3 ("the busy state lives on the control that was
pressed... never a full-screen overlay"; "`WelcomeScreen`'s Google button
already does the label swap; that is the pattern") — exactly the regression
the operator suspected the boot fix introduced. Track Q's own report only
reasons about the `restore()` path; this case isn't mentioned there and
wasn't covered by any existing test (`WelcomeScreen.test.tsx`'s busy-state
test sets `status: 'authenticating'` directly on `WelcomeScreen`, bypassing
`RequireAuth` entirely).

**Fixed** in `src/features/auth/RequireAuth.tsx`: a `booted` ref
disambiguates "the mount-time `restore()` call is still in flight" (real
boot span → `BootScreen`) from "`authenticating` for some other reason,
`WelcomeScreen` was already showing" (falls through to `WelcomeScreen`,
which owns its own busy state). `booted.current` flips true once the mount
effect's own `restore()` attempt settles (or immediately, if the component
never mounted with `'idle'`).

Watched fail first: `keeps the welcome screen on screen when login() is
triggered from it, instead of swapping in the boot placeholder` — failed
with the boot placeholder (`role="status"`) present instead of the busy
Google button, before the fix; passes after.

**Second-order bug in my own first draft of the fix, also caught and
fixed:** deriving `booted` per-effect-invocation is not `StrictMode`-safe.
`main.tsx` wraps the app in `<StrictMode>`, which double-invokes this
mount effect in dev (same component instance, so refs survive the pair).
The _second_ invocation sees `status` already flipped away from `'idle'`
by the first invocation's synchronous pre-await `set()` inside `restore()`,
takes the "wasn't idle" branch, and would mark `booted` true immediately —
reopening the exact boot-flash bug, in dev only, for any `restore()` slower
than one microtask. Added a second `attemptedBoot` ref to make the whole
effect body run exactly once regardless of `StrictMode`, and a dedicated
regression test (`does not end the boot window early under StrictMode
double-invocation...`) that renders through a real `<StrictMode>` wrapper
with a controllable, slow `restore()` and asserts the boot placeholder
survives the double-invoke. Watched it fail (welcome screen appeared while
`restore()` was still pending) before the `attemptedBoot` guard, pass after.

Guard-ordering sweep the operator asked for, traced end to end: `guest` →
never reaches the `driveOptIn` check (correct, tested). `authenticating`
(genuine boot) → `BootScreen`, not `WelcomeScreen` (correct, tested, now
also StrictMode-safe). `!authenticated` (covers `idle` and `error`) →
`WelcomeScreen`, so an `error` status is visible (correct, tested — the
existing "shows a welcome-screen error message when status is error" test).
`idle` on first mount still renders `WelcomeScreen` for one render before
the effect fires and calls `restore()` — pre-existing, unchanged by this
track, and per Track Q's report "effectively unobservable in practice"
since `restore()` flips to `authenticating` synchronously before its first
`await`; I did not find a way to make this observable in a real browser
paint and didn't chase it further, since it predates this track and isn't
in its diff.

### 2. PIN-lock reasoning — CONFIRMED by tracing, matches Track Q's chain

Traced independently, not trusted from the report:

- `AppLock` (`src/features/lock/AppLock.tsx`) wraps `RouterProvider` (hence
  `RequireAuth`) entirely; `phase === 'locked'` renders `LockScreen` instead
  of children. `lockStore.init()`'s phase resolution
  (`src/lib/lockStore.ts:100-132`) depends only on `hasVault()`, never on
  `authStore.status`.
- `pinLock.enableLock()` requires `opts.session` as a required parameter,
  and `lockStore.enable()` (`src/lib/lockStore.ts:133-138`) throws
  `NO_SESSION_ERROR` when `useAuthStore.getState().session` is `null` — a
  guest's `session` is always `null` (`continueAsGuest()` sets it).
  Confirmed: a vault can only come to exist on a device that previously had
  a real, authenticated Google session enable it.
- Consequence, traced not assumed: `continueAsGuest()` is only reachable
  from `WelcomeScreen`, which only renders once `AppLock`'s `phase` is
  `'unlocked'`. If a vault exists, `phase` starts `'locked'` and
  `WelcomeScreen` (and therefore the guest button) never mounts until a
  correct PIN/biometric clears it. A guest genuinely cannot bypass a
  device-level lock.
- `lockStore.resume()` (`src/lib/lockStore.ts:55-92`, called only from
  `unlockPin`/`unlockBiometric`, both only reachable while `phase ===
'locked'`) always calls `authStore.hydrate(session)` with a session
  decrypted from the vault, settling `status` to `'authenticated'` or
  `'error'` — never `'guest'`. Since `resume()` can only run before
  `RequireAuth` (and thus `continueAsGuest`) exist, a guest can never be
  "behind" a vault in the locked sense — it's structurally impossible, not
  just untested. `isBackgroundExpired()` (`src/lib/pinLock.ts:325-329`)
  also returns `false` when no vault exists, so a guest with no vault at
  all can never get relocked by the background timer either.

**One pre-existing gap, not introduced by this track, flagged for
awareness only — no fix applied (out of scope, not a guest-specific
issue):** `logout()` resets `authStore` but never calls `lockStore.lock()`.
On a device with an enabled lock, a user who authenticates, then logs out
without a full reload, leaves `lockStore.phase` at `'unlocked'` with the
DEK still resident in memory for that tab. `WelcomeScreen` (including the
guest button) becomes reachable in that state without a fresh unlock. This
already existed before guest entry — the same exposure applies to
re-authenticating via Google after a same-session logout — and predates
this diff entirely, so I did not fix it here; flagging in case the operator
wants a follow-up (`logout()` calling `lockStore.getState().lock()` when
`enabled`).

### 3. CONFIRMED and fixed — `HomeHeader.tsx` assumed `user` past the guard

Track Q's own report flagged this correctly and correctly left it (outside
its file ownership, and a product decision). `src/features/home/HomeHeader.tsx`
read `useAuthStore((s) => s.user?.name ?? '')` behind a comment claiming
`RequireAuth` "guarantees `user` is set" — false for a guest, so a guest's
Home header rendered a blank name and a blank avatar (`getInitials('')`
returns `''`).

**Fixed:** `HomeHeader.tsx` now reads `status === 'guest'` and substitutes
an honest `home.guestName` label ("Invitado"/"Guest"/"Convidado", added to
all four locale files, `es` first) instead of the real name. The avatar
badge derives its initial from that same label via the existing
`getInitials()` (no special-casing needed — "Invitado" → "I"), so nothing
renders blank. Deleted the false "`RequireAuth` guarantees `user` is set"
comment.

Watched fail first: `shows an honest guest label instead of a blank name
for a guest session` — failed (`getByText('Invitado')` not found) before
the fix; passes after.

**Sweep — same shape, re-run independently of Track Q's own sweep:**
`grep -rn '\.user\b|s\.user\b'` and `grep -rn "status === 'authenticated'"
/"driveOptIn"` across `src/`, excluding tests and the auth/lock files
themselves. Result: nothing else. `HomeHeader.tsx` was the only `.user`
read outside `authStore.ts`/`lockStore.ts`/`src/features/auth/**`, and no
`status === 'authenticated'`/`driveOptIn` read exists outside
`authStore.ts`/`RequireAuth.tsx`. Matches Track Q's own sweep result.

### 4. Layout question — judgment, no code change

The legal line ("Al continuar aceptas los Términos…") sits in the same
`flex flex-col gap-4` container as everything else, immediately after the
Google button (1rem/`gap-4` separation) and _before_ the divider, which
adds its own `my-6` (1.5rem) on top of the container gap — so the legal
line is ~1rem from the Google button but ~2.5rem from the divider. It
visually reads as attached to the Google action, not to "using the app at
all."

I think that reading is wrong for what the copy actually says. "Al
continuar aceptas los Términos" is a continuing-into-the-app statement, not
a Google-specific one — guest is also a way of "continuing." As written,
the layout implies guest entry carries no such acknowledgment, which isn't
the intent. I'd recommend moving the legal line below both zones (after the
guest reassurance text), so it reads as governing entry via either path. I
did not make this change — it's a copy/layout judgment call as requested,
not a traced bug, and `WelcomeScreen.tsx`'s existing tests
(`getByText(/este dispositivo/i)`, the divider/guest-button tests) don't
assert on this ordering either way, so nothing blocks moving it if you want
it.

Separately: the divider zone's own separation from the buttons on either
side of it (~2.5rem, on a `h-14`/56px button) does read as generous on a
360-430px screen — that part delivers on §10.10's requirement. The guest
button's visual weight (outlined `border-border-subtle`/`bg-transparent`
vs. the Google button's solid white/shadow) is correctly secondary.

### 5. Reload persistence reasoning — agree

Traced the constraint that drives the operator's decision: there is
genuinely no route back out of guest mode today. `continueAsGuest()` sets
`status: 'guest'` with no persisted marker, `driveOptIn` is irrelevant to a
guest (checked first in `RequireAuth`), and no Profile/Settings screen
exists yet (Track G is Wave 3) to offer "sign in with Google" from inside
guest mode. If guest state persisted across a reload with no Google login
possible from inside it, a guest who reloads would be permanently stuck —
worse than the current "retap Continue as guest," which at minimum keeps
both choices reachable every time. The reasoning holds; I found no case
where persisting it would be strictly better under the current app
surface. Revisit when Track G ships the Profile screen with a real
guest→Google path — the trade-off changes then.

### 6. Security — clean

No new OAuth scopes touched (didn't touch `auth.ts`), no backend calls, no
`localStorage`/`sessionStorage` reads or writes in any changed file
(`grep` came back empty), no secret in an error/log/DOM path in the changed
code. `continueAsGuest()`/`RequireAuth`'s `status === 'guest'` branch never
reaches `DrivePermissionScreen` or any Drive call — confirmed both by
reading the guard order and by the existing/added tests. No
authenticated-only surface exists yet for a guest to wrongly reach (Wave 3).

### 7. i18n — clean, all four locale files key-identical

Diffed `auth` namespace's new keys (`welcome.orDivider`, `welcome.guestCta`,
`welcome.guestReassurance`, `boot.loading`) across all four locale files —
present in all four, none left in English in the other three, and the
guest reassurance copy is honestly translated per locale, not a stock
phrase. Same check applied to the `home.guestName` key I added for finding 3.

## What I left, and why

- The pre-existing `logout()` not calling `lockStore.lock()` gap (finding 2) — out of scope for this track's diff, not guest-specific, flagged for
  a follow-up decision.
- The legal-line placement (finding 4) — a layout/copy judgment call, not a
  bug; recommendation given, not applied.
- `BootScreen`'s `SEAM(track-p)` swap for the real `ScreenLoading` — Track
  P has now merged (`f78d09e`) so the seam is technically unblocked, but
  `docs/waves.md` explicitly assigns that swap to "the operator," not
  either track's agent, and it's outside my brief's listed scope. Left
  untouched; flagging that it's ready whenever you want it done. (Also
  note: Track P's own `ScreenLoading` isn't gated by `usePendingDelay`
  either at its one other call site, `router.tsx`'s `/kit` Suspense
  fallback — so gating boot's loader would be a new pattern, not a copy of
  an existing one, if you do want it.)

## Doc lines to hand you (READMEs untouched per instructions)

- `src/features/home/README.md`, `HomeHeader.tsx` bullet — append: ", and
  an honest `home.guestName` label (never a blank name/avatar) when
  `authStore.status === 'guest'` (specs.md §10.10)."
- `src/features/auth/README.md` and `src/lib/README.md` — Track Q's own
  report (`docs/wave-2.2/track-q.md`, "Doc lines to add") drafted lines for
  both; checked, neither was ever applied. Repeating them here since
  they're still accurate and still missing:
  - `src/features/auth/README.md`, after the `RequireAuth.tsx` bullet:
    "Guest entry: `WelcomeScreen`'s 'Continuar como invitado' button calls
    `authStore.continueAsGuest()`, landing on the distinct `status:
'guest'` (never `'authenticated'` with a synthesized user).
    `RequireAuth` checks `status === 'guest'` first and renders `children`
    directly, skipping both `WelcomeScreen` and `DrivePermissionScreen`.
    `RequireAuth` also renders a minimal inline boot placeholder (marked
    `SEAM(track-p)`) while the mount-time `restore()` attempt is still
    settling, instead of flashing `WelcomeScreen` (specs.md §10.9) — gated
    by a ref, not `status` alone, so an explicit `login()` from an
    already-visible `WelcomeScreen` isn't mistaken for the boot span."
  - `src/lib/README.md`, in the `authStore.ts` bullet, append: ", plus
    `continueAsGuest()` for the guest entry path (`status: 'guest'`,
    distinct from `'authenticated'` — specs.md §10.10)."

## Tests watched fail before fixing (TDD)

- `src/features/auth/RequireAuth.test.tsx`:
  - `keeps the welcome screen on screen when login() is triggered from it,
instead of swapping in the boot placeholder` — failed (boot placeholder
    shown instead of the busy Google button) before the `booted` ref;
    passes after.
  - `does not end the boot window early under StrictMode double-invocation
while the real restore() is still pending` — failed (welcome screen
    appeared while the real `restore()` was still pending) before the
    `attemptedBoot` ref; passes after.
- `src/features/home/HomeHeader.test.tsx`:
  - `shows an honest guest label instead of a blank name for a guest
session` — failed (`getByText('Invitado')` not found) before the fix;
    passes after.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  72 passed (72)
      Tests  693 passed (693)
```

The single oxlint warning is the same pre-existing shadcn-generated file
Track Q's own report noted, untouched here. Rebased onto `main`
(`f78d09e`, Track P's merge) before this run; `git diff main..HEAD --stat`
shows exactly the 8 files this review touches.
