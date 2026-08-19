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
  offering it to a PIN-only user always fails.
- `LockSettings.tsx` — enable/disable/re-lock controls. This is a **dev/test
  harness**, not the polished settings UI (`specs.md` §12) — the visual
  design is a separate, not-yet-written spec.
- `errorCopy.ts` — maps a raw `pinLock.ts`/`lockStore.ts` error message to
  the Spanish, actionable copy `LockScreen`/`LockSettings`/`AppLock` actually
  render (`unlockErrorCopy`, `enableLockErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7).

All screens read `useLockStore` (`@/lib/lockStore`) for state.
