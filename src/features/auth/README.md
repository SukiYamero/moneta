# src/features/auth

Onboarding screens and the route guard that sits in front of the app.

- `WelcomeScreen.tsx` — "Continuar con Google" screen, shown while
  unauthenticated; triggers the real `authStore.login()` (identity scopes
  only, §5). A successful `login()` marks this device via
  `@/lib/loginMarker` — the signal `RequireAuth`'s silent-restore attempt
  (below) is gated on (`specs.md` §11, 2026-08-19).
- `DrivePermissionScreen.tsx` — shown once per authenticated session, right
  after login, before the app. "Permitir y continuar" calls
  `authStore.connectDrive()` (busy overlay + inline error on failure);
  "Ahora no" calls `authStore.dismissDrive()` and continues local-first.
  This is the real caller for `connectDrive` (specs.md §10.1/§10.4/§12).
- `RequireAuth.tsx` — route guard: unauthenticated → `WelcomeScreen`;
  authenticated with `driveOptIn === 'pending'` → `DrivePermissionScreen`;
  otherwise renders `children`. Its mount-time silent `restore()` only ever
  fires when `authStore.restore()` finds the `loginMarker` set — never on a
  genuine first visit, and never right after a PIN lockout clears it
  (`pinLock.resetVault()` clears the marker too — `specs.md` §11,
  2026-08-19).
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
