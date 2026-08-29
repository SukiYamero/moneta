# Drive status row stops lying about "up to date"

## Goal

The Drive status row never reads "up to date" right after a sync attempt
that just failed.

## The gap, precisely

`src/lib/sync/status.ts`'s `deriveSyncIndicator({ isSyncing, outboxDirty })`
never looks at `useSyncStore.lastError`. A **push** failure is already
mostly self-correcting today — a failed push leaves unpushed entries in the
outbox, so `outboxDirty` stays true and the row already reads "pending," not
"up to date." The real gap is a **pull** failure with a clean outbox
(nothing locally pending, network/parse error on the download itself): both
`isSyncing` and `outboxDirty` are false, so the row falsely reads "up to
date" even though the last attempt to actually confirm that just failed.

## Rules (each one is a bug if violated)

1. `deriveSyncIndicator` takes a third input, `lastError: string | null`
   (`useSyncStore.lastError` already exists and is already cleared to `null`
   at the start of every pull/push attempt — no new state to add).
2. **Priority order**: `syncing` (a fresh attempt already running) beats
   `error` (the last attempt failed and nothing has succeeded since) beats
   `pending` (dirty outbox, no known failure) beats `up_to_date`. A
   currently-running sync always wins even over a known prior error, since
   it may be about to resolve it.
3. `SyncIndicator` gains an `'error'` member. `SyncSection.tsx` passes
   `lastError` through from `useSyncStore`, and its `STATUS_LABEL_KEY`/icon
   `Record<SyncIndicator, ...>` lookups (already a `Record`, per this repo's
   lookup-table rule) each get the new `'error'` entry — never a new
   `if`/`switch` branch next to the existing tables.
4. New i18n copy for the error state, in all four locales, following
   `docs/error-handling.md`'s existing conventions for surfacing a failure
   (never `error.message` raw) — a short, honest label like "couldn't sync,"
   not alarming, not the raw error string.

## Explicitly out of scope

Adding a manual retry action on the status row is a natural next step but
not required here — this task only makes the indicator honest, it doesn't
add new interactions. Note it as a follow-up if it comes up during review,
don't build it preemptively.

## Files this task owns

`src/lib/sync/status.ts`, `src/features/profile/SyncSection.tsx`, the
relevant `src/lib/i18n/locales/*.json` keys, and their tests. Fully
isolated from every other open sync task — no shared files.

## Acceptance per rule

1. Test: `deriveSyncIndicator` accepts and uses `lastError`.
2. Test table (`it.each`): every combination of `isSyncing`/`outboxDirty`/
   `lastError` resolves to the rule-2 priority order, including the specific
   case this task exists for — `{ isSyncing: false, outboxDirty: false,
lastError: 'some error' }` → `'error'`, not `'up_to_date'`.
3. Test: `SyncSection` renders the new label/icon for the `'error'` case,
   sourced from the `Record` lookups, not a new conditional.
4. Manual/regression: the four locale files all have the new key under the
   same path as the existing `status.*` keys.
