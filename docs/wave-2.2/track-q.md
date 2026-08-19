# Track Q — report

## Decisions made (for specs.md §11)

- **Guest modeled as a new `AuthStatus` value (`'guest'`), not an orthogonal
  `mode` field on top of `'authenticated'`.** `authStore.status` is now
  `'idle' | 'authenticating' | 'authenticated' | 'guest' | 'error'`. Chose
  this over an orthogonal `mode: 'authenticated' | 'guest'` field because a
  new status makes `status === 'authenticated'` **structurally false** for a
  guest with zero extra checks anywhere — the exact property specs.md
  §10.10 demands ("do not synthesize a `user`/`session` to slip past the
  guard"). An orthogonal-mode design would have required every future
  `status === 'authenticated'` check across the codebase to _also_ remember
  to check mode, which is precisely the "fake authenticated user" trap
  AGENTS.md's postmortem stories warn about. `user`/`session`/`drive` stay
  `null` for a guest; `driveOptIn` resets to its default `'pending'` (see
  edge case below).

- **`continueAsGuest()` mirrors `logout()`'s reset shape exactly**, ending in
  `status: 'guest'` instead of `'idle'`, and bumps the same
  `authGeneration` counter `logout()`/`connectDrive()` use — defensive
  parity, not a traced race (see Open questions).

- **PIN lock and guest: no code change, verified by tracing, not guessed.**
  `AppLock` (`src/features/lock/AppLock.tsx`) wraps the _entire_ app,
  outside `RequireAuth`/the router — `phase === 'locked'` renders
  `LockScreen` instead of `children` (which is `RouterProvider` →
  `RequireAuth`). `lockStore.init()`'s phase resolution depends only on
  `hasVault()`, never on `authStore.status`. And `pinLock`'s `enable()`
  throws `NO_SESSION_ERROR` when `authStore.session` is `null`
  (`src/lib/lockStore.ts:134`) — so a vault can only ever come to exist on a
  device that previously had a real, authenticated Google session enable
  it. Two consequences, both CONFIRMED by reading the code, not assumed:
  1. A device that has never had an authenticated session with lock
     enabled has no vault, `AppLock` resolves `'unlocked'` immediately, and
     the guest path proceeds exactly as built here — there is nothing to
     protect, so the lock plays no role at all.
  2. A device that _does_ have a vault (because a prior Google-authenticated
     session on it enabled the lock) will show `LockScreen` before
     `RequireAuth` — and therefore `WelcomeScreen` — ever mounts, exactly as
     it already does today for a returning, logged-out visitor. A guest
     cannot bypass a device-level lock a previous session deliberately
     turned on; the existing PIN/biometric/lockout flow is what clears it.
     This is unchanged, pre-existing `AppLock` behavior — I did not touch
     `AppLock.tsx`/`lockStore.ts` (not owned by this track), and no new
     "skip the lock for guest" bypass was added, which would have been the
     wrong fix (a device-level lock guarding a _different_ prior
     authenticated session's cached token must stay a device-level lock).

- **`driveOptIn` cannot reappear the Drive screen for a guest, by
  construction, not by a special-cased check.** `RequireAuth` tests
  `status === 'guest'` _before_ it ever reads `driveOptIn`, so the value of
  `driveOptIn` is irrelevant to the guest render path. `continueAsGuest()`
  still resets `driveOptIn` to `'pending'` (its default) purely so a
  _future_ caller that reads `driveOptIn` without checking `status` first
  isn't lied to by a stale `'connected'`/`'dismissed'` left over from
  whatever session preceded this guest entry — belt-and-suspenders, not
  load-bearing for the guarantee.

- **Guest mode does not persist across a cold reload — a deliberate,
  in-memory-only, per-session field**, same posture as the existing
  `driveOptIn` precedent (specs.md §11, 2026-08-18): "the whole auth session
  is already access-token-only and rebuilt on every cold start by design."
  A guest gets no equivalent of `hasLoggedInBefore()`'s silent-restore
  marker. Concretely: reloading the app after choosing guest lands back on
  `WelcomeScreen`, requiring another tap. specs.md §10.10's "Done when" list
  doesn't ask for reload persistence, and I did not add a new device-level
  persistence mechanism for it (see Open questions — I think this is right
  but want it confirmed, since the edge-case wording about the Drive screen
  "reappearing on every boot" could be read as implying guest state should
  survive a boot).

- **Boot-flash fix scoped to `status === 'authenticating'` only, not
  `'idle'`.** `'authenticating'` is the state for the _entire_ duration of
  `restore()`'s network calls — the actually-observable flash. The one
  render where `status` is still `'idle'` (before the mount effect fires)
  keeps showing `WelcomeScreen`, unchanged from before and matching the
  existing `RequireAuth.test.tsx` coverage — that transition is
  synchronous and effectively unobservable in practice (`restore()` flips
  to `'authenticating'` before its first `await`).

## Backlog / deferred (for specs.md §12)

- **`BootScreen` in `RequireAuth.tsx` is a deliberately minimal seam**,
  marked `// SEAM(track-p): ...` — swap it for the shared `ScreenLoading`
  component once Track P's loading system (specs.md §10.9) merges to
  `main`. It uses a bare `Loader2` spin, an `auth:boot.loading` sr-only
  string, and `bg-background` — no attempt to match `ScreenLoading`'s
  eventual design.
- **No guest→Google migration UI or "you are in guest mode" banner** — both
  explicitly out of scope per specs.md §10.10, untouched here.
- **Guest reload persistence** (see decision above) — not built. If the
  operator wants "continue as guest" to survive a cold reload the way
  Google login does, that's a `deviceStore.ts` addition (a boolean marker
  analogous to `hasLoggedInBefore`, consulted by `RequireAuth`'s mount
  effect before falling back to `WelcomeScreen`) plus wiring it through
  `authStore` — deliberately not built pending confirmation this is wanted.

## Doc lines to add

- `src/features/auth/README.md`: after the `RequireAuth.tsx` bullet, add —
  "Guest entry: `WelcomeScreen`'s 'Continuar como invitado' button calls
  `authStore.continueAsGuest()`, landing on the distinct `status: 'guest'`
  (never `'authenticated'` with a synthesized user). `RequireAuth` checks
  `status === 'guest'` first and renders `children` directly, skipping both
  `WelcomeScreen` and `DrivePermissionScreen`. `RequireAuth` also renders a
  minimal inline boot placeholder (marked `SEAM(track-p)`) while
  `status === 'authenticating'`, instead of flashing `WelcomeScreen`
  (specs.md §10.9)."
- `src/lib/README.md`: in the `authStore.ts` bullet, append — ", plus
  `continueAsGuest()` for the guest entry path (`status: 'guest'`, distinct
  from `'authenticated'` — specs.md §10.10)."

I did not edit either README myself per this track's "hand me the lines"
instruction.

## Spec deltas

None — specs.md §10.10 as written matches what was built. No behavior
contradicts the spec; the two ambiguities I resolved (reload persistence,
scope of the boot-flash fix) are flagged above and in Open questions rather
than silently decided against the text.

## Open questions for the operator

1. **Should "continue as guest" persist across a cold reload?** specs.md
   §10.10's edge case about `driveOptIn` "reappearing on every boot" reads,
   on one interpretation, as implying guest state is expected to survive a
   boot (otherwise "every boot" wouldn't be a live concern for an ephemeral
   choice). I decided against building this for v1 (see Backlog), on the
   grounds that (a) the "Done when" list doesn't ask for it, (b) it matches
   the existing `driveOptIn` in-memory-only precedent, and (c) my chosen
   design (`status === 'guest'` checked before `driveOptIn`) makes the
   literal Drive-screen-reappearing failure mode structurally impossible
   regardless of persistence. But this is a real product-UX question, not
   just an implementation detail — a guest who reloads currently has to
   retap "Continue as guest" every time, unlike an authenticated user.
2. **CONFIRMED, not fixed by me — real bug for a guest reaching Home:**
   `src/features/home/HomeHeader.tsx:13-16` reads
   `useAuthStore((s) => s.user?.name ?? '')` and its own comment asserts
   "`RequireAuth` guarantees `user` is set whenever this renders, since
   authStore sets `status: 'authenticated'` and `user` together" — that
   invariant is now false for a guest. The `?? ''` prevents a crash, but
   `getInitials('')` returns `''`
   (`src/features/home/homeView.ts:19-24`), so a guest's Home header
   renders a blank avatar circle and a blank name line under the greeting.
   This is exactly the defect class AGENTS.md's "fix the shape, not the
   instance" section calls out — a guest walking into code that assumes a
   Google user. I did **not** fix it: `HomeHeader.tsx` isn't in this
   track's file ownership (it's part of the Home screen, adjacent to Track
   P's in-flight loading work on the same screens), and the fix is a
   product decision as much as a code one (show nothing? a generic
   "Invitado" label? no avatar circle at all?). Sweep method: grepped
   `\.user\b` and `s\.user` across `src/` excluding tests — this is the
   only hit outside `authStore.ts`/`lockStore.ts`/`src/features/auth/**`.
   No other `status === 'authenticated'` or `driveOptIn` reads exist
   outside `authStore.ts`/`RequireAuth.tsx` — confirmed the same way.

## Tests watched fail before implementing (TDD)

- `src/lib/authStore.test.ts` — `useAuthStore.continueAsGuest` describe
  block (2 tests): failed with `TypeError: useAuthStore.getState(...).continueAsGuest
is not a function` before the store gained the action.
- `src/features/auth/RequireAuth.test.tsx` — the guest-bypass test and the
  authenticating-boot-flash test: both failed (guest fell through to
  `WelcomeScreen`; `'authenticating'` also rendered `WelcomeScreen` with no
  `role="status"` element) before `RequireAuth.tsx` was changed.
- `src/features/auth/WelcomeScreen.test.tsx` — the three new guest-button/
  divider/reassurance tests: failed (`getByText`/`getByRole` not found)
  before the UI was added.

All were watched fail for the reason described (missing implementation),
then made to pass by the corresponding implementation change, per
AGENTS.md's TDD requirement for `authStore`.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  71 passed (71)
      Tests  678 passed (678)
```

The single oxlint warning is a pre-existing shadcn-generated file
(`src/components/ui/button.tsx`), untouched by this track.

Ran again after rebasing onto `main` (`ffc4dbc`), with `git diff main..HEAD
--stat` showing exactly the 10 files this track owns — same green result.
