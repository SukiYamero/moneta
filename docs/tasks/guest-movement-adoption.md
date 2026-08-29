# Guest movement adoption — additive, repeatable, no accidental dismiss

## Goal

Bringing guest movements into a Google-authenticated profile never risks
losing data to an accidental tap, stays available for as long as there is
something to bring in (not just once at login), and never empties the guest
profile it copies from.

## What exists today

`src/features/auth/GuestAdoptionPrompt.tsx` + `src/lib/authStore.ts`
(`pendingAdoption`, `acceptGuestAdoption`, `declineGuestAdoption`) +
`src/lib/profiles/adoption.ts` (`adoptGuestMovements`, `countGuestMovements`,
`finishConsentedAdoption`, `resumePendingAdoption`) + `src/lib/deviceStore.ts`
(`adoptionDeclined`/`adoptionConsent` tables).

- The prompt fires once, only from inside `authStore.ts`'s `login()` (never
  from `restore()`/`hydrate()`), gated by `hasDeclinedAdoption()` — a single
  device-wide flag with no per-account scoping.
- `adoptGuestMovements` today is a **move**: `targetDb.movimientos.bulkPut(...)`
  then `db.movimientos.bulkDelete(...)` on the guest db. This must become
  **copy-only** — drop the `bulkDelete` entirely.

## Rules (each one is a bug if violated)

1. **The prompt cannot be dismissed except by its own two buttons.**
   `CenterModal`'s backdrop-tap and Escape both currently call
   `onClose={decline}` via `useOverlay`/`useBackdropDismiss` — pass a no-op
   instead so only `acceptCta`/`declineCta` resolve the prompt. A tap outside
   or Escape must do nothing.
2. **Accepting never touches the guest profile's data.** The guest profile
   keeps every movement it had, unchanged, indefinitely — "adopting" is a
   `bulkPut` into the target only.
3. **The action is repeatable and idempotent, not one-shot.** A Profile-screen
   entry (new) is visible any time the active profile is Google-authenticated
   and has at least one guest movement not yet present in it. Re-invoking it
   — including after switching back to the local profile via the profile
   switcher and adding more movements there post-adoption, which is a real
   path — must only copy the delta, and must be safe to tap with nothing left
   to copy (disabled or hidden, never an error).
4. **The one-time login prompt stays** as a discoverability nudge the first
   time it's relevant, but it is no longer the only way in. Declining it, or
   losing it to an app-close mid-decision, must never be a dead end — see the
   gap below.
5. **The outbox enqueue mechanics stay exactly as they are**
   (`enqueueOperation` per movement, `alreadyQueued` guard). The new
   "copy the delta" logic computes "which guest movement ids are not yet in
   the target db," not "which ones have no outbox entry" — a movement can be
   present without a live outbox row after compaction.
6. **A copy still uploads to Drive automatically** via the existing outbox →
   `sync/engine.ts` push path. Do not add a second sync trigger.

## Known gap this closes

Today, closing the app before tapping either button on `GuestAdoptionPrompt`
silently drops the offer through the normal flow: `pendingAdoption` is
in-memory only, and neither `hydrate()` nor `restore()` ever call
`checkGuestAdoption()` again (only `login()` does). No data is lost, but the
affordance disappears with no way back. The persistent Profile-screen entry
(rule 3) is the fix — it doesn't depend on that in-memory state at all.

## Implementation notes

- The new entry lives in its **own new component**, not `DataSection.tsx` —
  that file belongs to `docs/tasks/profile-data-erasure.md`, and this task
  runs in parallel with it. Add the new component to `specs.md` §10.18's
  `ProfileSheet.tsx` composition list with a one-line addition there.
- `countGuestMovements()` needs to become something like
  `countUnadoptedGuestMovements(targetDb)` — diff against the target's ids —
  rather than a flat `db.movimientos.count()`, per rule 3.
- i18n: `auth.adoption.*` keys across all four locales need wording that says
  "add," never "move" — `declineNote` ("se quedan en este dispositivo, en su
  propio perfil") is already accurate and can stay. Add new keys for the
  Profile-screen entry (title, count-aware description, CTA, success/empty
  state) — check `docs/voice-and-tone.md` before wording them.
- `adoption.test.ts` and any `authStore`/`GuestAdoptionPrompt` tests touching
  adoption need rewriting for: no-dismiss-on-backdrop/Escape, copy-not-move
  (assert the guest db is unchanged after accept), and the new delta-based
  entry point.

## Explicitly out of scope

The multi-device "same Google account synced on two devices" scenario is
**not a new problem this creates** — guest movement ids are freshly-generated
UUIDs with no collision possible, and the general case is already solved by
`sync/engine.ts`'s per-device op-log + HLC merge (`specs.md` §10.19): a newly
copied movement just shows up as one more device's op on the next pull, no
conflict-resolution UI needed. Do not build one.

## Files this task owns

`src/features/auth/GuestAdoptionPrompt.tsx`, `src/lib/authStore.ts`,
`src/lib/profiles/adoption.ts`, `src/lib/deviceStore.ts` (adoption tables
only), a new Profile-screen component, `src/lib/i18n/locales/*.json`
(`auth.adoption.*` + new keys), the corresponding test files. Do not touch
`DataSection.tsx`'s delete-data stub — that is
`docs/tasks/profile-data-erasure.md`.

**Runs in parallel with `docs/tasks/profile-data-erasure.md`** — file sets
are disjoint (this task never touches `DataSection.tsx` or
`sync/driveFiles.ts`). The only shared files are the four
`src/lib/i18n/locales/*.json`, and each task only adds/edits its own keys
(`auth.adoption.*` here vs. `profile`/`dataSection` keys there) — rebase
before merging rather than assuming no diff overlap.

## Acceptance per rule

1. Test: tapping the backdrop / pressing Escape while `GuestAdoptionPrompt`
   is open leaves `pendingAdoption` unchanged and the modal open.
2. Test: after `acceptGuestAdoption()`, the guest db's `movimientos` count is
   unchanged from before.
3. Test: invoking the copy function twice only copies/enqueues once; a
   movement added to the guest profile after a first successful copy is
   picked up by a second call, and nothing else is re-copied.
4. Manual/regression: decline the login prompt, then reach the same result
   through the Profile-screen entry.
5. Existing outbox tests keep passing unmodified for the enqueue mechanics.
