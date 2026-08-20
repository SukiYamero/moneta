# Track AA — sign-out actually signs out, and a profile knows whose it is — report

`specs.md` §10.20. Branch `wave3.1/aa-signout`, worktree
`moneta-worktrees/wave31-aa`. Baseline confirmed green before starting:
97 files / 914 tests. Final: **98 files / 939 tests**, `bun run check` green
(pasted in full below).

## The failing test, and what it proved

Before touching `authStore.ts`, added a test against the real defect:

```ts
it('invalidates the PIN-lock vault so a correct PIN cannot resurrect this account', () => {
  useAuthStore.setState({
    status: 'authenticated',
    user: { email: 'a@b.com', name: 'Ana' },
    session: { accessToken: 'tok', expiresAt: 1 },
  })
  useAuthStore.getState().logout()
  expect(mResetVault).toHaveBeenCalledOnce()
})
```

Run before any implementation change: **failed** —
`expected "vi.fn()" to be called once, but got 0 times`. This is the exact
shape of the traced defect: `logout()` reset in-memory state and cleared the
Drive decision, but called nothing that touches the vault at all. A second
test (`'still completes sign-out even when vault invalidation itself
fails'`) also failed first, for the matching reason — nothing existed yet to
even attempt invalidation, so there was nothing to fail. Both pass after the
fix; the second one specifically proves the "must never trap the user"
edge case: `resetVault` mocked to reject still leaves `status: 'idle'`,
`session: null` (asserted synchronously, no await needed — see below), and
the failure reaches `console.error`, not silence.

Same TDD discipline applied to the other three deliverables (see their own
sections): a test asserting the not-yet-built behavior, run once to confirm
it fails for the right reason, then the implementation.

## How vault invalidation handles its own failure

`authStore.logout()` now calls `pinLock.resetVault()` — the **existing**,
already-tested function used for the lockout/reset paths, not a new one
(`pinLock.ts` is untouched by this track, per the brief's "invalidate, not
restructure"). It deletes the vault row, forgets the resident DEK, and
clears this device's login marker and Drive decision — all three already
proven correct by `pinLock.test.ts`.

The call is fire-and-forget and wrapped in a local, self-catching helper
(`invalidateVaultOnLogout`), same posture as the file's existing
`syncLockedSession`:

```ts
const invalidateVaultOnLogout = async (): Promise<void> => {
  try {
    await resetVault()
  } catch (e) {
    console.error('lock: failed to invalidate the vault on sign-out', e)
  }
}
```

`logout()` itself is synchronous and performs its `set({ status: 'idle', ...
})` state reset **before** this is even called — so "sign-out completes
regardless of storage" is true by construction, not by a race that happens
to resolve favorably. If `resetVault()` fails, the account is still left in
this tab; the residual risk (documented, not hidden) is that the vault row
itself may survive in storage, so a **future** cold boot in a tab that never
saw this failure could still show a PIN screen for the old account. This
track does not silently retry — a `console.error` is the durable trace, and
retry policy is a separate call the operator should make (see "Deferred").

`lockStore.ts`'s existing `useAuthStore.subscribe` (the "same-tab logout
re-locks" fix from `specs.md` §12) had to change in the same commit: with
the vault now being deleted, re-locking behind it — the old behavior — would
strand the current tab on a PIN screen that can never succeed. It now resets
directly to `{ phase: 'unlocked', enabled: false, error: null }` and calls
`forgetDek()` unconditionally (cheap no-op when nothing was ever enabled).
Two of that subscription's three existing tests changed their assertions to
match (documented inline as a deliberate behavior change, not a bug fix to
the test); the third (idle-to-idle, no real transition) needed no change.

## The account key: how it's established, and what happens to a profile from before it existed

`ProfileRecord` gains `accountKey?: string` — additive, optional,
`undefined` for `'local'`/guest. `RegisterProfileInput` gains the same
field. A new `resolveGoogleProfile({ accountKey, label })` in
`profileRegistry.ts`:

- looks for an existing `kind: 'google'` profile with a matching
  `accountKey` (matched by key, never by `label` — a display name can
  repeat or change); if found, touches its `lastUsedAt` and returns it;
- otherwise mints a fresh id (`crypto.randomUUID()`), a
  `makeProfileDatabaseName(id)` database name, and registers it via the
  existing (untouched) `registerProfile()`.

Wired from `authStore.ts` into the three places a Google session is
actually established — `login()`, `restore()`'s silent-auth success branch,
and `hydrate()` (the PIN-unlock path) — via a self-catching
`syncProfileForAccount(user)` helper, same posture and same call order as
the existing `syncLockedSession`. Guest sessions never call it (no
`user`/email to key on).

This is deliberately **not** a new resolution algorithm bolted onto
`getActiveProfile()`. That function already resolves "the active profile"
by pure recency, and Wave 5+ owns the switcher — this track's job (per the
brief) was narrower: make sure the **right** profile is the freshest one.
Since `resolveGoogleProfile` touches the matched profile's `lastUsedAt`
every time that account's session is (re-)established, `getActiveProfile()`
needs zero changes to become identity-correct: whichever account just
signed in is, by construction, now the most-recently-touched row. Verified
directly:

```ts
test('signing back into a previously-used account makes it the active profile again', async () => {
  const ana = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })
  await resolveGoogleProfile({ accountKey: 'beto@example.com', label: 'Beto' })
  expect((await getActiveProfile()).accountKey).toBe('beto@example.com')

  const anaAgain = await resolveGoogleProfile({ accountKey: 'ana@example.com', label: 'Ana' })
  expect(anaAgain.id).toBe(ana.id)
  expect((await getActiveProfile()).id).toBe(ana.id)
})
```

**What happens to a profile created before the field existed:** nothing,
because none exists. `registerProfile()` had **zero production callers**
before this track (confirmed by grep — the only prior callers were tests
and the untested-in-prod `getActiveProfileRepo()`), so there has never been
a shipped `'google'` profile without an `accountKey`. This is stated
plainly rather than hedged: "additive, no migration owed" (the brief's own
words) is the literal truth here, not an assumption.

Two things deliberately **not** done, both flagged rather than silently
skipped:

- `resolveGoogleProfile` does not refresh an existing profile's `label` if
  the Google account's display name changed since last time. Updating a
  stored label in response to upstream identity data is presentation logic
  adjacent to renaming, which the brief explicitly reserves for Wave 5+.
  Commented at the call site; not filed separately in §12 since it's a
  narrow, already-documented deferral, not a gap.
- `repoProvider.ts` is untouched, on purpose — it's Track V's file and
  explicitly out of this track's blast radius. The registry is now
  identity-correct; nothing yet routes real per-profile data through it
  (the stub flip is a separate, already-deferred decision, `specs.md`
  "Wave 3 — staging and dependencies").

## The sign-out confirm modal: exactly when it shows

New `src/features/profile/useSignOutConfirm.ts` (its own hook, its own
8-test file, so `IdentitySection.tsx` stays markup):

- **Drive connected** (`authStore.driveOptIn === 'connected'`): signs out
  immediately. No outbox read, no modal — nothing at risk to warn about.
- **Drive not connected, nothing unsynced**: reads
  `outbox.listPendingOperations()`, counts **distinct `movimiento`
  `entityId`s** (not raw entries — two queued edits to the same movement
  read as "1 movement", matching the copy's stated quantity; a queued
  `config` write is never counted, it isn't a movement), gets 0, signs out
  directly.
- **Drive not connected, N unsynced movements**: opens `ConfirmDialog`
  (built on the existing `CenterModal`/`useOverlay` stack — confirmed
  correct to nest inside `ProfileSheet`'s `BottomSheet`, since
  `useOverlay.ts`'s own module comment names exactly this nesting shape as
  what the stack was built for) with the real count interpolated via
  i18next's `_one`/`_other` plural keys. Cancel closes it, signs out
  nothing. Confirm signs out (which already keeps the data — `specs.md`
  §10.15's "nothing is ever replaced" is `authStore.logout()`'s existing
  behavior; this hook only decides whether to say so first).
- **Storage failure reading the outbox**: `listPendingOperations()`
  already self-catches to `[]` (existing `outbox.ts` behavior, untouched);
  this hook adds no second catch, so a broken read fails open — signs out
  without the modal rather than blocking sign-out on a broken count. Matches
  the brief's "sign-out must still complete" posture.

## The delete control cannot read as armed

`DataSection.tsx` gained a second control, below Export:

```tsx
<Button type="button" variant="destructive" size="touch" disabled aria-disabled="true" ...>
  <Trash2 aria-hidden="true" />
  {t('data.deleteStored.cta')}
</Button>
```

Confirmed inert three ways: (1) no `onClick` prop exists on the element at
all — there is nothing to wire, not a handler that early-returns; (2) native
`disabled` — `shadcn`'s `Button` already applies
`disabled:pointer-events-none disabled:opacity-50`, so no click is even
dispatched; (3) `aria-disabled="true"` makes the state explicit for
assistive tech beyond what native `disabled` alone announces. A test clicks
it via `userEvent` and asserts it stays disabled afterward, and a second
test asserts the explanatory note (`data.deleteStored.note`) renders. Ships
with a `STUB(wave5)` comment naming what the real control needs: a second
confirm step naming the exact profile being wiped (unlike sign-out, this
is genuinely destructive and irreversible), the actual delete
(`profileDb.ts`'s `getProfileDatabase` + drop it, plus the registry row),
and the constraint that it must stay reachable only as this explicit,
secondary action — never a side effect of signing out.

One deliberate deviation from `PreferencesSection.tsx`'s precedent: that
section renders its inert rows as plain `<div>`s specifically to avoid
looking like a dead tap target, since those are read-only **values**, not
actions. A future delete **action** is different — a disabled destructive
`Button` is the standard, correct pattern for "this action exists and this
is what it will look like, but it isn't available yet," and native
`disabled` semantics communicate that state unambiguously. Both approaches
satisfy "cannot read as armed"; they're just the right tool for a value
versus an action.

## The sweep

Per "fix the shape, not the instance," forked a sweep across every other
place that could cache, persist, or resurrect a session/identity in a way
that would let a signed-out user (or the wrong account) come back without a
fresh login. Checked: every `deviceStore.ts` signal (login marker + Drive
decision — both already cleared by `resetVault()`; the `anchor`/`profiles`
tables — correctly untouched, neither is identity-linked or meant to clear
on sign-out); `networkStore.ts`'s offline-write anchor (a timestamp, no
account linkage); `dataStore.ts`/`repoProvider.ts`/`repo.local.ts`/
`repo.fake.ts` (no cached "current user" anywhere; `repoProvider` resolves
the active profile fresh on every call); every auth/lock screen component
(all read `useAuthStore`/`useLockStore` live, none holds local session
state); every `localStorage`/`sessionStorage` use (zero — matches
`AGENTS.md`); every other `.put(`/`.add(` writing to IndexedDB outside
`pinLock.ts` (none session-shaped); and every caller of
`hasLoggedInBefore()`/`markLoggedIn()` (only ever `authStore.ts`'s
`login()`/`restore()` — nothing else can re-mark a device as "logged in
before" without a real login).

**Result: nothing else found.** Reported plainly rather than padded — the
sweep came back clean.

## Decisions for `specs.md` §11 (exact lines, operator-applies)

```
- 2026-08-19 — Sign-out invalidates the vault by calling the **existing**
  `pinLock.resetVault()` (fire-and-forget, self-catching) from
  `authStore.logout()`, rather than adding a second vault-clearing path.
  This also clears the device's login marker and Drive decision as a side
  effect (`resetVault()`'s existing behavior), which is correct here too:
  without it, `restore()`'s silent re-auth could sign the just-left account
  back in on the very next cold boot if the browser's own Google session
  was still alive — the same resurrection defect, via a different path.
  `lockStore.ts`'s existing same-tab-logout subscription (`specs.md` §12,
  2026-08-19) changed from re-locking to resetting directly to
  `{ phase: 'unlocked', enabled: false }`, since re-locking behind a vault
  that is being deleted can only strand the tab on a PIN screen that can
  never succeed.

- 2026-08-19 — `ProfileRecord.accountKey` (additive, optional) is set via a
  new `resolveGoogleProfile()` in `profileRegistry.ts`, called from
  `authStore.ts`'s `login()`/`restore()`/`hydrate()` success paths.
  Deliberately does not change `getActiveProfile()`'s own resolution logic
  (still pure recency, Track V's design) — touching the right profile's
  `lastUsedAt` on every session establishment is sufficient to make that
  existing recency resolution identity-correct. No migration: `registerProfile()`
  had zero production callers before this track, so no `'google'` profile
  without the field has ever shipped.

- 2026-08-19 — The sign-out confirm modal (`specs.md` §10.20) counts
  **distinct movement ids** from `outbox.listPendingOperations()`, not raw
  outbox entries, so two queued edits to one movement read as "1" — matching
  the copy's literal claim.

- 2026-08-19 — The "delete stored data" stub (`specs.md` §10.20) is a
  disabled, destructive `Button` (native `disabled` + `aria-disabled`), not
  an inert `<div>` in `PreferencesSection.tsx`'s style — that pattern is for
  read-only *values*, this is a future *action*, and a disabled real control
  is the correct way to represent "exists, not available yet" for an action.
```

## Deferred, for `specs.md` §12 (exact lines, operator-applies)

```
- **The backlog's existing "CONFIRMED DEFECT, open: 'Sign out' does not
  sign anyone out..." entry (added by Track Y's review) is now RESOLVED**
  by Track AA (`specs.md` §10.20, `docs/wave-3/aa.md`). Remove that entry
  or mark it closed with a pointer here — it should not still read as open.

- **A vault-invalidation failure on sign-out is logged, not retried.** If
  `pinLock.resetVault()` throws (storage blocked, quota), the current tab
  still signs out cleanly (state reset happens first, unconditionally), but
  the vault row can survive in storage — a *different*, later tab/cold-boot
  that never saw the failure could still show a PIN screen for the old
  account. No retry/queue exists for this narrow window; `console.error` is
  the only trace today.

- **`resolveGoogleProfile` never refreshes an existing profile's `label`**
  when the Google account's display name has changed since it was first
  registered. Deliberate (documented at the call site) — updating a stored
  label from upstream identity data is adjacent to Wave 5+'s renaming
  feature, not this track's job.

- **`src/features/lock/README.md`'s closing paragraph is now stale** — it
  still describes the pre-§10.20 "re-locks the vault... case it actually
  changes is a future caller (e.g. a Settings 'sign out' action)" behavior,
  which this track changed. `src/features/lock/` is not in this track's
  blast radius, so it was not edited here. Exact replacement text:

  > All screens read `useLockStore` (`@/lib/lockStore`) for state.
  > `useLockStore` also listens for `useAuthStore`'s logout transition (a
  > module-scope `useAuthStore.subscribe` in `@/lib/lockStore`, not an
  > import back into `authStore.ts`) and resets to `phase: 'unlocked'`,
  > `enabled: false` when a same-tab `logout()` fires — `authStore.logout()`
  > now invalidates the vault itself (`specs.md` §10.20), so re-locking
  > behind it would strand the tab on a PIN screen that can never succeed.

- **`ConfirmDialog`'s confirm button is hardcoded `variant="destructive"`**
  with no way to opt out. Reused as-is for the sign-out dialog even though
  signing out (which keeps the data) is not itself a destructive action the
  way a delete confirmation is — a minor copy/styling mismatch, not fixed
  here since `ConfirmDialog` belongs to Track U, outside this track's blast
  radius.

- **The `docs/waves.md` worktree log has no row for this track's worktree**
  (`../moneta-worktrees/wave31-aa`, `wave3.1/aa-signout`) — it was created
  before this track started, not by this track, so it was never logged.
  Separately, the log's existing `wave3-y` row (`../moneta-worktrees/wave3-y`)
  appears stale: `git log` shows Track Y already merged to `main`
  (`aaa999a Merge review of track Y…`, `5f97f34 Merge track Y…`) before this
  track began. Both are `docs/waves.md` edits, which is operator-owned.
```

## Spec deltas

`specs.md` §10.20 itself needs no correction — everything built matches
what was written. One adjacent, pre-existing line is now inaccurate and is
called out above rather than silently left: §10.2's own edge-case list
still says "logout keeps the vault," which was true when written and is the
literal defect this track just fixed. Exact line for the operator:

```
Before (§10.2, "Edge cases"):
  ...wrong PIN → throttle (5 → forced re-login); corrupt vault → re-login;
  logout keeps the vault; offline unlock defers silent re-auth.

After:
  ...wrong PIN → throttle (5 → forced re-login); corrupt vault → re-login;
  logout invalidates the vault (specs.md §10.20); offline unlock defers
  silent re-auth.
```

## Open questions

- Should a failed vault invalidation retry (on next app open, next
  successful storage write, etc.) rather than only logging once? Left as a
  §12 item — the brief's "must complete" requirement is satisfied either
  way; this is about closing the residual storage-failure window, a
  separate product/reliability call.
- `ConfirmDialog`'s fixed destructive styling for its confirm button (noted
  above) — worth a `variant` prop on `ConfirmDialog` itself if a
  non-destructive confirm ever needs the same overlay guarantees again.
  Not this track's call (Track U's file).

## `bun run check` (real output)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:74:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave31-aa

 Test Files  98 passed (98)
      Tests  939 passed (939)
   Start at  21:52:05
   Duration  17.57s (transform 2.77s, setup 17.82s, import 52.89s, tests 21.64s, environment 51.43s)
```

The single `button.tsx` warning is pre-existing (baseline, not introduced by
this track — confirmed by the baseline `bun run check` run before any edit).

## Files touched (matches the declared blast radius exactly)

`src/lib/authStore.ts` (+test), `src/lib/lockStore.ts` (+test),
`src/lib/profiles/profileRegistry.ts` (+test), `src/lib/profiles/index.ts`,
`src/lib/profiles/README.md`, `src/features/profile/IdentitySection.tsx`
(+test), `src/features/profile/DataSection.tsx` (+test),
`src/features/profile/useSignOutConfirm.ts` (new, +test),
`src/features/profile/README.md`, and all four
`src/lib/i18n/locales/*.json`. `pinLock.ts` was read but not edited — the
fix reuses its existing `resetVault()` unchanged.
