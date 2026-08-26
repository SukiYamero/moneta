# src/features/boot

Presentation for the boot sequence: what a signed-in or guest user sees
between "auth resolved" and "the app is actually usable." The sequencing
logic itself (`useBootStore`) lives in `src/lib/boot.ts`, not here.

- `BootGate.tsx` — wraps the protected app content (used inside both
  `RequireAuth` usages in `src/router.tsx`) and drives `useBootStore.run()`.
  Renders `PreContentSkeleton` while `status !== 'ready'`, `BootErrorScreen`
  on failure, `children` once ready.
- `PreContentSkeleton.tsx` — real `BottomNav` chrome plus the real Home
  skeleton (`@/features/home/HomeLoadingState`), mirroring `AppShell`/`Home`'s
  layout. Used by both `BootGate` and `RequireAuth` (while a returning
  device's `restore()` is resolving).
- `BootErrorScreen.tsx` — full-screen failure state when the local database
  can't be opened, with a retry that calls `run()` again.

No barrel — both call sites import `BootGate` directly.
