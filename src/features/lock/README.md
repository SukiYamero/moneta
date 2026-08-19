# src/features/lock

PIN/biometric lock UI, layered on top of auth.

- `AppLock.tsx` — top-level gate reading the lock phase; renders
  `LockScreen` when locked, otherwise renders `children`.
- `LockScreen.tsx` — the unlock UI (PIN keypad + biometric button).
- `LockSettings.tsx` — enable/disable/re-lock controls. This is a **dev/test
  harness**, not the polished settings UI (`specs.md` §12) — the visual
  design is a separate, not-yet-written spec.

All three read `useLockStore` (`@/lib/lockStore`) for state.
