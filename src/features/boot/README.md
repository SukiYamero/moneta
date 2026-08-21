# src/features/boot

The boot sequence's UI (`specs.md` §10.28, §10.29): what a signed-in or guest
user sees between "auth resolved" and "the app is actually usable." The
sequencing logic itself (`src/lib/boot.ts`'s `useBootStore`) lives in
`src/lib/`, not here — this folder is presentation only.

- `BootGate.tsx` — wraps the protected app content (`src/router.tsx`, inside
  both `RequireAuth` usages) and drives `useBootStore.run()`. Renders
  `PreContentSkeleton` while `status !== 'ready'`, `BootErrorScreen` on
  failure, `children` once ready. No floor, no timing state (specs.md
  §10.29 withdrew the ~800ms brand moment the same day it was decided): a
  remount that finds boot already `'ready'` (e.g. navigating from `/` to
  `/settings`, separate top-level routes) renders `children` instantly, no
  extra bookkeeping needed for that case.
- `PreContentSkeleton.tsx` — what covers the pre-content span (specs.md
  §10.29): the real `BottomNav` chrome plus the real Home skeleton
  (`@/features/home/HomeLoadingState`), mirroring `AppShell`/`Home`'s own
  layout so the transition into real content is a fill, not a swap.
  Deliberately not `AppShell` relocated — no `Outlet`, no sheets, no routing
  state. Used identically by `RequireAuth` (while a _returning_ device's
  `restore()` is still resolving — never for a genuine first visit, which
  goes straight to `WelcomeScreen` instead) and by `BootGate` above, so the
  two spans render the same output and the handoff between them is never
  itself a visual change.
- `BootErrorScreen.tsx` — the honest failure §10.28 requires when the local
  database can't be opened (private mode, denied storage, quota) — full-
  screen, styled after `HomeErrorState`'s card treatment, with a retry that
  calls `run()` again. Never a white screen, never a silent fallback to the
  fake repo. This one full-screen treatment is a terminal error state, not a
  loading treatment — it doesn't count against §10.29's "zero full-screen
  loading treatments" rule.

There is no `BootScreen.tsx` (deleted, specs.md §10.29): the design export
has no splash/boot artboard at all, and the brand moment it used to hold for
was withdrawn the same day it shipped, once the design that replaced it
turned out to have none either.

No barrel — both call sites (`src/router.tsx`) import `BootGate` directly,
matching `src/features/auth/`'s own convention for a small feature folder.
