# Outbox profile integrity, and the push debounce value

## Goal

A local write is always enqueued into the outbox of the exact profile it was
written against — never a profile that became active later because a switch
raced the write. Bundled in: bump the push debounce to its agreed value.

**Take this one first among the open sync tasks.**
`docs/tasks/categoria-own-sync-entity.md` rewrites `dataStore.ts`'s category
mutations to also go through `runMutation` — landing this task's fix first
means that one builds on the corrected version instead of two branches
independently touching the same function.

## The bug, precisely

`src/lib/dataStore.ts`'s `runMutation` (used by every `create`/`update`/
`delete` on `Movimiento`/`Config`/`Categoria`) does:

```
applyOptimistic()
result = await write()              // write() calls getRepo() synchronously,
                                     // correctly pinned to the profile active
                                     // when the mutation started
const queued = await enqueueOperation(onSuccess(result))   // <-- no database arg
```

`enqueueOperation` with no explicit `database` resolves its target table from
`src/lib/outbox.ts`'s module-level `entries` binding, read **at the moment
`enqueueOperation` actually runs** — after the `await write()` gap. If
`setOutboxDatabase()` reassigns `entries` to a different profile during that
gap (a profile switch, or a fast logout+relogin, racing the write), the
operation — carrying the real `Movimiento`/`Config` payload written under the
**old** profile — gets queued into the **new** profile's outbox instead. That
profile's next push would then upload the old profile's data into its own
Drive folder: a cross-account data leak when the two profiles are different
Google accounts, not just a misfile.

`sync/engine.ts`'s `push()`/`pull()` and `profiles/adoption.ts`'s
`adoptGuestMovements()` already avoid this — both take an explicit
`ProfileDb` throughout, never touching the module-level fallback.
`dataStore.ts` is the one remaining caller that doesn't.

## Rules (each one is a bug if violated)

1. **`runMutation` captures its target database once, synchronously, before
   `write()` runs** — `getActiveProfileBinding()?.database`
   (`src/lib/repoProvider.ts` already exposes this; it's the same module-level
   binding `getRepo()` reads) — and threads that captured value explicitly
   into `enqueueOperation(op, database)`. Never let this call site fall back
   to `outbox.ts`'s implicit binding.
2. This applies the **existing** explicit-database pattern consistently — it
   does not invent a new one. No new exports, no new abstraction beyond
   passing an already-available value one level further.
3. `PUSH_DEBOUNCE_MS` in `src/lib/sync/engine.ts` moves to **6000ms**.
   Current value is 8000ms (bumped mid-session from the original 3000ms,
   before this task existed) — this task's job is 8000 → 6000, not 3000 → 6000.
   Unrelated to rule 1–2, bundled here because both live in the same
   sync/outbox surface.

## Implementation notes

- `runMutation`'s signature doesn't need to change for its callers (every
  `create`/`update`/`delete`/`upsertCategoria`/etc. in `dataStore.ts` keeps
  calling it exactly as today) — the fix is internal to `runMutation` itself.
- If `getActiveProfileBinding()` returns `null` at mutation start, that's
  already an unreachable state per `getRepo()`'s own guard (every screen
  renders behind `BootGate`) — no new null-handling branch needed beyond
  what already exists.
- `PUSH_DEBOUNCE_MS` is a bare constant in `engine.ts`; tests already pass an
  explicit `debounceMs` override to `startSyncTriggers()` for determinism, so
  changing the default doesn't touch test timing.

## Files this task owns

`src/lib/dataStore.ts` (`runMutation` only), `src/lib/sync/engine.ts`
(`PUSH_DEBOUNCE_MS` only), corresponding tests. Does not touch `outbox.ts`,
`profiles/adoption.ts`, or `repoProvider.ts` — all already correct or
unrelated.

## Acceptance per rule

1. Test: start a mutation, resolve `write()`, then — before
   `enqueueOperation` runs — simulate a profile switch (change what
   `getActiveProfileBinding()` would return). Assert the outbox entry lands
   in the **original** profile's database, never the switched-to one.
2. Code review: no new exported function, no new module-level state — only
   `runMutation` passing an already-available value through.
3. Test/regression: `PUSH_DEBOUNCE_MS` reads 6000; a debounced-push test
   using the real default (if any exist beyond the overridden ones) reflects
   the new timing.
