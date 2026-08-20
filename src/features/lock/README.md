# src/features/lock

PIN/biometric lock UI, layered on top of auth.

- `AppLock.tsx` — top-level gate reading the lock phase; renders
  `LockScreen` when locked, otherwise renders `children`. Also renders a
  dismissible `role="alert"` banner (fed by `lockStore.error` +
  `unlockErrorCopy`) whenever `phase !== 'locked' && error` — the one place
  a lockout or failed session-restore message survives the same `set()`
  that unmounts `LockScreen` (`specs.md` §11, 2026-08-19).
- `LockScreen.tsx` — the unlock UI (PIN keypad + biometric button). The
  biometric button is gated on `lockStore.biometricEnrolled` (this vault's
  own enrollment), not `biometricAvailable` (platform capability) —
  offering it to a PIN-only user always fails. A correct PIN/biometric with
  no network now unlocks cleanly (`specs.md` §10.11): `authStore.hydrate()`
  no longer gates entry on `fetchGoogleUser`, so `lockStore.resume()`'s own
  `SESSION_RESTORE_ERROR` check is a defensive invariant rather than a live
  path for the offline case — see `@/lib/lockStore`'s own comment on that
  check.
- `LockSettings.tsx` — enable/disable/re-lock controls. This is a **dev/test
  harness**, not the polished settings UI (`specs.md` §12) — the visual
  design is a separate, not-yet-written spec. Its copy is real (routed
  through the `lock` namespace), even though the layout stays plain.
- `errorCopy.ts` — maps a raw `pinLock.ts`/`lockStore.ts` error message to a
  translation key in the `lock` namespace's `errors` group
  (`unlockErrorCopy`, `enableLockErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7), and never Spanish copy directly: the
  component resolves it (`t(unlockErrorCopy(error))`), the same split
  `src/features/auth/errorCopy.ts` already established (`specs.md` §10.24,
  Wave 4 stage 2 — the retrofit `specs.md` §12 had open since Wave 2).

All screens read `useLockStore` (`@/lib/lockStore`) for state.
`useLockStore` also listens for `useAuthStore`'s logout transition (a
module-scope `useAuthStore.subscribe` in `@/lib/lockStore`, not an import back
into `authStore.ts`) and resets to `phase: 'unlocked'`, `enabled: false` when a
same-tab `logout()` fires — `authStore.logout()` now invalidates the vault
itself (`specs.md` §10.20), so re-locking behind it would strand the tab on a
PIN screen that can never succeed.
