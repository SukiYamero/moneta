# src/features/lock

PIN/biometric lock UI, layered on top of auth.

- `AppLock.tsx` — top-level gate reading the lock phase; renders
  `LockScreen` when locked, otherwise renders `children`.
- `LockScreen.tsx` — the unlock UI (PIN keypad + biometric button).
- `LockSettings.tsx` — enable/disable/re-lock controls. This is a **dev/test
  harness**, not the polished settings UI (`specs.md` §12) — the visual
  design is a separate, not-yet-written spec.
- `errorCopy.ts` — maps a raw `pinLock.ts`/`lockStore.ts` error message to
  the Spanish, actionable copy `LockScreen`/`LockSettings` actually render
  (`unlockErrorCopy`, `enableLockErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7).

All three screens read `useLockStore` (`@/lib/lockStore`) for state.
