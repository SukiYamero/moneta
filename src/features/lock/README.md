# src/features/lock

PIN/biometric lock UI, layered on top of auth. All screens read `useLockStore` (`@/lib/lockStore`) for state.

- `AppLock.tsx` — top-level gate reading `lockStore`'s phase; renders `LockScreen` when locked, otherwise `children`. Also renders a dismissible error banner (`lockStore.error` + `unlockErrorCopy`) when unlocked.
- `LockScreen.tsx` — dispatches on `lockStore.lockKind` between two shells, both built on the shared `IconTile` (exported from this file):
  - `AccountLockScreen` (default) — `PinDots` + `PinPad` (auto-submits at 4 digits) + a biometric button gated on `lockStore.biometricEnrolled`, plus "Olvidé mi PIN" which opens a `ConfirmDialog` that calls `lockStore.reset()`.
  - `GuestLockScreen` — biometric-only, no keypad, attempts the platform ceremony once on mount, with a manual retry button.
- `LockSettings.tsx` — full-screen settings panel (`FullScreenPanel`) reached from `src/features/profile/SecuritySection.tsx`. Toggle to enable/disable the lock (enabling opens `PinSetup` in `'new'` mode, disabling calls `lockStore.reset()`), plus "Cambiar PIN" (`PinSetup` in `'change'` mode) and "Bloquear ahora" (`lockStore.lock()`).
- `PinSetup.tsx` — full-screen create/confirm PIN flow (`FullScreenPanel`). Two steps (create → confirm); a mismatch on confirm clears back to an empty confirm entry. Offers a biometric-enroll toggle on the confirm step when `lockStore.biometricAvailable`, then calls `lockStore.enable(pin, biometric)`.
- `PinPad.tsx` — PIN-shaped wrapper around `@/components/shared/NumericKeypad`; exports `PIN_LENGTH` (4) as the single source of truth for PIN length.
- `PinDots.tsx` — the row of filled/outline dot indicators (all-red on error).
- `FullScreenPanel.tsx` — push-in full-screen overlay shell shared by `LockSettings`/`PinSetup`, built on `useOverlay` (focus-trap/Escape/scroll-lock). Takes an optional `header` prop for fixed chrome above a scrolling body.
- `errorCopy.ts` — maps a raw `pinLock.ts`/`lockStore.ts` error to a translation key in the `lock` namespace (`unlockErrorCopy`, `enableLockErrorCopy`); components resolve it via `t()`, never render raw error text.

`src/features/profile/SecuritySection.tsx` (outside this directory) is the only caller of `LockSettings` and owns the guest-vs-account entry point branch.
