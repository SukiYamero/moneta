# track-k — report

## Decisions made (for specs.md §11)

- **Duplicate collapse resets that one card's own timer.** Read "a later
  arrival never extends, resets, or shortens an earlier one" as protecting
  _distinct_ toasts from each other — a re-raised identical
  `(variant, message)` pair is the same notification happening again, so
  restarting its own clock (and bumping `count`) is the intended reading,
  not a violation. Implemented and tested both ways in
  `src/lib/toastStore.test.ts`.
- **A toast raised while the app is locked is dropped at the source, not
  just hidden by unmounting `Toaster`.** `toastStore.ts`'s `raiseToast()`
  checks `useLockStore.getState().phase === 'locked'` and no-ops
  immediately, before anything is added to the stack. Gating only at
  `Toaster`'s render (i.e. `{phase !== 'locked' && <Toaster />}` in
  `AppLock.tsx`) is necessary but not sufficient on its own: a toast raised
  while locked would still sit in the store with a live 4–7s timer, and if
  the user unlocks before that timer fires, `Toaster` remounts and shows
  it — exactly the "queued" behavior §10.6 forbids. The two together (push
  refused at the source, plus `Toaster` never mounted over `LockScreen`)
  make the drop unconditional regardless of timing. This means
  `toastStore.ts` imports `@/lib/lockStore` — a read (`.getState().phase`),
  never an edit to that file; flagged under Open questions below since the
  brief lists `lockStore.ts` as "must not touch."
- **`Toaster` mounts inside `AppLock.tsx`, not `main.tsx`.** The brief listed
  `src/main.tsx` under "Owns," but specs.md §10.6 and the brief's own
  "Lock interaction" bullet both place `Toaster` inside `AppLock`, which is
  already nested inside `AppErrorBoundary` in `main.tsx` — so `main.tsx`
  needed no edit at all. Left it untouched.
- **Stacking order without pixel bookkeeping.** `toastStore.ts` keeps
  `items` oldest-first; `Toaster.tsx`'s container uses `flex-col-reverse`
  over that array, which anchors the oldest card at the bottom edge and
  grows the stack upward as newer ones arrive — satisfies "oldest at the
  anchored edge" and "the rest must not jump when one in the middle leaves"
  through ordinary DOM flow, no computed offsets.
- **z-index.** `Toaster`'s portal uses `z-[60]` — the app's overlays
  (`BottomSheet`, `CenterModal`) are both `z-50`; nothing higher existed to
  reuse, and `z-*` isn't a "new token" under the design-tokens doc (spacing/
  color/radius/animation are tokenized, z-index isn't).
- **`toast` namespace keys:** only two, since the notification message
  itself is always caller-supplied, already-localized copy —
  `toast.dismiss` (close-button `aria-label`) and `toast.repeatSuffix`
  (`"×{{count}}"`, the duplicate-count badge). Added, translated, to all
  four locale files.

## Backlog / deferred (for specs.md §12)

- `src/components/shared/ToastKitDemo.tsx` exists (buttons that call
  `toast.success`/`toast.error`, including a duplicate-collapse and a
  stack-cap demo) but is **not wired into `/kit`** — `src/routes/Kit.tsx` is
  owned by Track L's parallel worktree this stage. Once free: import
  `ToastKitDemo` and drop it into a `<Section title="Toast">` block. It
  renders no `<Toaster />` of its own — one is already mounted globally by
  `AppLock` for every route, `/kit` included, so a second instance would
  double-render every card.
- The bottom clearance in `Toaster.tsx`
  (`pb-[calc(6rem+env(safe-area-inset-bottom))]`) is a guess at how much
  space a real bottom nav needs — no `BottomNav` exists yet in this branch
  (Track L is building it in parallel). Worth a look once it merges; adjust
  if the toast stack overlaps or floats too far above it.

## Doc lines to add (say exactly which file and where)

`src/components/shared/README.md` — operator-owned this wave, so not
edited directly. Suggested addition, after the `InfoButton.tsx` bullet and
before the `index.ts` bullet:

> - `toastStore.ts` (in `src/lib/`) — the global notification store: plain
>   `toast.success(message)`/`toast.error(message)` functions, callable from
>   anywhere with no provider. Stack capped at 3 (oldest dropped on a 4th
>   arrival); each card owns its own dismiss timer (4s success / 7s error);
>   an identical `(variant, message)` re-raise collapses into the existing
>   card instead of stacking a duplicate, bumping its count and resetting
>   its own timer. Drops a toast outright if raised while the app is locked
>   (`useLockStore.getState().phase === 'locked'`) rather than queuing it for
>   after unlock. Callers must pass already-localized copy — this module
>   never looks up copy itself and never renders a raw `error.message`
>   (`docs/error-handling.md` §5/§7).
> - `Toast.tsx` — a single card: `role="alert"`/`role="status"` by variant,
>   swipe-to-dismiss via Pointer Events (`touch-pan-y`, mirrors
>   `BottomSheet`'s drag handling), always has a keyboard-reachable close
>   button (WCAG 2.2.1 — a timed message must stay dismissible without
>   relying on the swipe gesture).
> - `Toaster.tsx` — the stack: subscribes to `toastStore`, portals to
>   `document.body`, `z-[60]` (above `BottomSheet`/`CenterModal`'s `z-50`).
>   Mounted once, inside `AppLock`, only while `phase !== 'locked'`
>   (`specs.md` §10.6) — never a screen's own concern.
> - `ToastKitDemo.tsx` — dev-only exercise panel for `/kit` (see
>   `docs/wave-2/track-k.md`); deliberately not in the public barrel.

## Spec deltas (anything where the brief below turned out wrong)

None. `specs.md` §10.6 and the wave-2-plan brief were both directly
implementable; the only correction was file-scoped (`main.tsx` needed no
edit — see Decisions above), not a behavior/spec disagreement.

## Open questions for the operator

- **`toastStore.ts` reads `@/lib/lockStore`** (`useLockStore.getState().phase`)
  to implement "dropped, not queued." The brief lists `lockStore.ts` under
  "Must not touch" — read that as "don't edit," since a read-only import of
  another store's public state is the existing pattern in this codebase
  (`AppLock.tsx` itself calls `useLockStore.getState().init()`). Flagging in
  case the intent was a harder boundary — an alternative exists (gate only
  in `AppLock`/`Toaster` and accept the "queued if unlocked before the timer
  fires" race), but it's a strictly weaker guarantee against the exact
  failure mode §10.6 names.
- The `pb-[calc(6rem+…)]` bottom-nav clearance guess above — flag if it
  needs to become a shared value once Track L's `BottomNav` exists, rather
  than a number picked blind in this track.
