# src/features/auth

Onboarding screens and the route guard that sits in front of the app.

- `WelcomeScreen.tsx` — "Continuar con Google" screen, shown while
  unauthenticated; triggers the real `authStore.login()` (identity scopes
  only, §5). A successful `login()` marks this device via
  `@/lib/deviceStore` — the signal `RequireAuth`'s silent-restore attempt
  (below) is gated on (`specs.md` §11, 2026-08-19).
- `DrivePermissionScreen.tsx` — shown once per authenticated session, right
  after login, before the app. "Permitir y continuar" calls
  `authStore.connectDrive()` (busy overlay + inline error on failure);
  "Ahora no" calls `authStore.dismissDrive()` and continues local-first.
  This is the real caller for `connectDrive` (specs.md §10.1/§10.4/§12).
- `RequireAuth.tsx` — route guard: unauthenticated → `WelcomeScreen`;
  authenticated with `driveOptIn === 'pending'` → `DrivePermissionScreen`;
  otherwise renders `children`. Its mount-time silent `restore()` only ever
  fires when `authStore.restore()` finds the `deviceStore` set — never on a
  genuine first visit, and never right after a PIN lockout clears it
  (`pinLock.resetVault()` clears the marker and the persisted Drive decision too — `specs.md` §11,
  2026-08-19). Offline (checked via `@/lib/networkStore`'s hint, no-lock
  boot path only): `restore()` skips the network call entirely and lands on
  `status: 'authenticated'` with `session`/`user` both `null` — nothing to
  decrypt on this path (no PIN vault), so the device's own login marker is
  the only evidence, and `RequireAuth`'s existing `status !== 'authenticated'`
  gate already renders `children` for it with no code change needed here
  (`specs.md` §10.11). Guest entry: `WelcomeScreen`'s "Continuar como invitado"
  button calls `authStore.continueAsGuest()`, landing on the distinct
  `status: 'guest'` (never `'authenticated'` with a synthesized user).
  `RequireAuth` checks `status === 'guest'` first and renders `children`
  directly, skipping both `WelcomeScreen` and `DrivePermissionScreen`.
  `RequireAuth` also renders the shared `ScreenLoading` (Tier 1, specs.md
  §10.9) while the mount-time `restore()` attempt is still settling,
  instead of flashing `WelcomeScreen` — gated by a `booted`/`attemptedBoot`
  ref pair, not `status` alone, so an explicit `login()` from an
  already-visible `WelcomeScreen` (or a `StrictMode` double-invoke) isn't
  mistaken for the boot span.
- `errorCopy.ts` — maps a raw `AuthError`/`DriveError` message to a
  translation key in the `auth` namespace's `errors` group
  (`loginErrorCopy`, `driveErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7). Stays a pure, i18next-free lookup;
  `WelcomeScreen`/`DrivePermissionScreen` resolve the key with `t()` at the
  render site, same as every other string on those screens.

All three screens read `useAuthStore` (`@/lib/authStore`) for state; none
hold local auth state of their own. The Google account-chooser screen from
the design canvas is intentionally not built here — GIS's `initTokenClient`
shows Google's real chooser in its own popup.
