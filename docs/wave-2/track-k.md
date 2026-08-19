# track-k — report

## Decisions made (for specs.md §11)

- **Duplicate collapse resets that one card's own timer.** Read "a later
  arrival never extends, resets, or shortens an earlier one" as protecting
  _distinct_ toasts from each other — a re-raised identical
  `(variant, message)` pair is the same notification happening again, so
  restarting its own clock (and bumping `count`) is the intended reading,
  not a violation. Implemented and tested both ways in
  `src/lib/toastStore.test.ts`.
- **`toastStore` reads no store — suppression is inverted, driven by `AppLock`.**
  First cut had `toastStore.ts` import `@/lib/lockStore` and check
  `.getState().phase` directly. Operator review caught two problems with
  that: (1) it violates specs.md §10.6's "Data touched: none... it holds no
  domain state and reads no store" — not decoration, it's what keeps
  `toastStore` a leaf every Wave 3 track (F/G/H) can import without
  dragging in WebCrypto/Dexie transitively via `lockStore` → `pinLock`; (2)
  it only checked `phase === 'locked'` exactly, so a toast raised during the
  `'unknown'` boot window (while `lockStore.init()` resolves, and `AppLock`
  itself renders `null`) was never dropped — it sat in the store with a
  live timer and would appear the moment the phase resolved, including to
  `'unlocked'`. Fixed by inverting the dependency: `toastStore.ts` now
  exposes `setToastsSuppressed(boolean)`, a domain-free flag `raiseToast`
  checks; `AppLock.tsx` — which already owns `phase` — drives it from an
  effect: `setToastsSuppressed(phase !== 'unlocked')`, so `'unknown'` and
  `'locked'` are both suppressed, only `'unlocked'` isn't. The flag starts
  `true` at module load (nothing is safe to show before whatever owns it
  has run its first effect). `setToastsSuppressed(true)` also clears
  whatever is currently in the stack (not just future arrivals) — the same
  bug shape one level up: a toast already visible when the app re-locks
  mid-display would otherwise sit in the store with a live timer and
  reappear on the next unlock, exactly like the boot-window case. Both
  directions tested: `toastStore.test.ts`'s `setToastsSuppressed` block at
  the store level, `AppLock.test.tsx`'s boot-window and re-lock-mid-toast
  tests at the integration level.
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
  (Track L is building it in parallel). Operator is resolving this at
  integration once both branches are on `main`, since the right fix (a
  shared layout constant vs. positioning `Toaster` inside the layout above
  the nav) depends on how L structured the layout route.

## Doc lines to add (say exactly which file and where)

`src/components/shared/README.md` — operator-owned this wave, so not
edited directly. Suggested addition, after the `InfoButton.tsx` bullet and
before the `index.ts` bullet:

> - `toastStore.ts` (in `src/lib/`) — the global notification store: plain
>   `toast.success(message)`/`toast.error(message)` functions, callable from
>   anywhere with no provider. Holds no domain state and reads no other
>   store (specs.md §10.6) — `setToastsSuppressed(boolean)` is a domain-free
>   flag driven by `AppLock` (which owns the lock phase), not a `lockStore`
>   import, so the dependency points policy → surface and nothing that
>   merely raises a toast drags in WebCrypto/Dexie transitively. Stack
>   capped at 3 (oldest dropped on a 4th arrival); each card owns its own
>   dismiss timer (4s success / 7s error); an identical `(variant, message)`
>   re-raise collapses into the existing card instead of stacking a
>   duplicate, bumping its count and resetting its own timer. Suppressing
>   clears whatever's currently in the stack too, not just future arrivals,
>   so nothing raised (or already visible) while suppressed can resurface
>   once it lifts. Callers must pass already-localized copy — this module
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

`src/features/lock/README.md` — operator-owned this wave, so not edited
directly. Worth a line noting `AppLock.tsx` now also drives
`toastStore`'s `setToastsSuppressed(phase !== 'unlocked')` from an effect,
alongside its existing `init()`/visibility-change responsibilities, if
that file gets a lock-side "what AppLock owns" summary.

## Spec deltas (anything where the brief below turned out wrong)

None. `specs.md` §10.6 and the wave-2-plan brief were both directly
implementable; the only correction was file-scoped (`main.tsx` needed no
edit — see Decisions above), not a behavior/spec disagreement.

## Open questions for the operator

None outstanding — the dependency-direction question from the first pass
(`toastStore` reading `lockStore`) is resolved per the inversion above.
