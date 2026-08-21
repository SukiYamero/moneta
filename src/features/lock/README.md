# src/features/lock

PIN/biometric lock UI, layered on top of auth.

The PIN surface is fully implemented from the design export
(`docs/ui/design-export-reference.md` §4, Track AF, Wave 4.1) — no more
dev/test-harness layout.

- `AppLock.tsx` — top-level gate reading the lock phase; renders
  `LockScreen` when locked, otherwise renders `children`. Also renders a
  dismissible `role="alert"` banner (fed by `lockStore.error` +
  `unlockErrorCopy`) whenever `phase !== 'locked' && error` — the one place
  a lockout or failed session-restore message survives the same `set()`
  that unmounts `LockScreen` (`specs.md` §11, 2026-08-19).
- `LockScreen.tsx` — dispatches on `authStore.status === 'guest'` between two
  shells sharing `IconTile` (accent-glow icon tile, exported for reuse):
  - `AccountLockScreen` (default): dynamic subtitle (biometric-enrolled vs.
    PIN-only), `PinDots`, a reserved-height error line, `PinPad`
    (auto-submits once 4 digits are entered — no separate "Unlock" button,
    matching the export), and "Olvidé mi PIN" below the pad. The biometric
    button is gated on `lockStore.biometricEnrolled` (this vault's own
    enrollment), not `biometricAvailable` (platform capability) — offering
    it to a PIN-only user always fails. "Olvidé mi PIN" is **not a new
    recovery mechanism** (`specs.md` §10.2.1): it opens the shared
    `ConfirmDialog` whose destructive action is `lockStore.reset()` — the
    exact vault-wipe + forced-relogin the code already performs after 5
    failed attempts, now offered as a manual, honestly-worded exit rather
    than something a user only discovers by failing. A correct PIN/
    biometric with no network still unlocks cleanly (`specs.md` §10.11) —
    see `@/lib/lockStore`'s own comment on why `SESSION_RESTORE_ERROR` is a
    defensive invariant, not a live path, for the offline case.
  - `GuestLockScreen` (`specs.md` §10.2.1): biometric-only, no keypad, no
    "Olvidé mi PIN" — a guest's credential gates the UI, not a
    cryptographic boundary, so there is no vault to wipe that would help a
    failed attempt; retrying the OS prompt is the only recovery, offered as
    a visible retry button. Tries the ceremony once automatically on mount.
    This branch **only ever mounts from an already-active guest session's
    own background timeout** (`lockStore.onVisible`) — a guest is never
    gated at cold start, since guest status itself isn't persisted across a
    reload (a separate, known gap, out of this track's ownership).
- `LockSettings.tsx` — the account lock's full-screen settings panel
  (`FullScreenPanel`, back-arrow header), reached by tapping the
  "Bloqueo con PIN" row in `src/features/profile/SecuritySection.tsx`. One
  card: the "Pedir PIN al abrir" toggle (turning it on opens `PinSetup` in
  `'new'` mode; turning it off calls `lockStore.reset()` directly — the same
  action "Olvidé mi PIN" offers, matching the behavior the prior
  `/kit`-only harness already shipped and tested), plus "Cambiar PIN"
  (opens `PinSetup` in `'change'` mode) and "Bloquear ahora"
  (`lockStore.lock()`) once enabled. Footer policy line.
- `PinSetup.tsx` — the full-screen create/confirm PIN flow (`FullScreenPanel`,
  X-close, uppercase kicker resolving to "Nuevo PIN"/"Cambiar PIN"). Two
  steps (create → confirm) driven by one `useEffect` watching `pin.length`;
  a mismatch on confirm shows an error and clears back to an empty confirm
  entry. Offers a biometric enroll `Toggle` on the confirm step only when
  `lockStore.biometricAvailable`, then calls the existing
  `lockStore.enable(pin, biometric)` — "change PIN" is not a distinct code
  path, it's the same call, which already always writes a brand-new vault.
  Steers `FullScreenPanel`'s initial-focus rAF at the hidden PIN input
  (`initialFocus`) rather than its default (the first focusable
  descendant, the X-close button) — leaving the default meant a focus
  steal could land mid-keystroke and drop characters typed via the hidden
  input (found chasing a flaky test, not just a test artifact: the same
  race is live for real keyboard/screen-reader PIN entry).
- `PinPad.tsx` — the shared 3×4 numeric keypad (`PIN_LENGTH`, the single
  source of truth for the PIN length, is exported from here). 12 slots — a
  blank cell, digits 0-9, delete — matching the export's own `padKeys`
  shape; never a submit key, callers auto-advance on `maxLength`.
- `PinDots.tsx` — the four dot indicators (filled/outline, or all-red on
  error).
- `FullScreenPanel.tsx` — the push-in full-screen overlay shell shared by
  `LockSettings`/`PinSetup` (`useOverlay`'s focus-trap/Escape/scroll-lock,
  same as `BottomSheet`/`CenterModal`, `z-[55]` so it sits above the
  Profile sheet it opens from). Not `src/components/shared/`: exactly two
  consumers, both inside this feature.
- `errorCopy.ts` — maps a raw `pinLock.ts`/`lockStore.ts` error message to a
  translation key in the `lock` namespace's `errors` group
  (`unlockErrorCopy`, `enableLockErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7), and never Spanish copy directly: the
  component resolves it (`t(unlockErrorCopy(error))`), the same split
  `src/features/auth/errorCopy.ts` already established (`specs.md` §10.24,
  Wave 4 stage 2 — the retrofit `specs.md` §12 had open since Wave 2).
  `GuestBiometricUnavailableError`'s message maps to the same
  `errors.biometricUnavailable` key as the account path's — the guest lock
  has no PIN fallback, so a near-duplicate locale key would say the same
  thing twice.

`src/features/profile/SecuritySection.tsx` (not in this directory, but the
only caller of `LockSettings`) owns the guest-vs-account branch at the entry
point: an authenticated account gets the "Bloqueo con PIN" row above; a
guest gets a single row + toggle for the session-less biometric lock
(`lockStore.enableGuestLock`/`disableGuestLock`), rendered only when the
platform has biometric capability — absent entirely otherwise, never a
disabled control (`specs.md` §10.2.1).

All screens read `useLockStore` (`@/lib/lockStore`) for state.
`useLockStore` also listens for `useAuthStore`'s logout transition (a
module-scope `useAuthStore.subscribe` in `@/lib/lockStore`, not an import back
into `authStore.ts`) and resets to `phase: 'unlocked'`, `enabled: false` when a
same-tab `logout()` fires — `authStore.logout()` now invalidates the vault
itself (`specs.md` §10.20), so re-locking behind it would strand the tab on a
PIN screen that can never succeed.
