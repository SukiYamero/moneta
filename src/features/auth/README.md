# src/features/auth

Onboarding screens and the route guard that sits in front of the app.

- `WelcomeScreen.tsx` — "Continuar con Google" screen, shown while
  unauthenticated; triggers the real `authStore.login()` (identity scopes
  only, §5).
- `DrivePermissionScreen.tsx` — shown once per authenticated session, right
  after login, before the app. "Permitir y continuar" calls
  `authStore.connectDrive()` (busy overlay + inline error on failure);
  "Ahora no" calls `authStore.dismissDrive()` and continues local-first.
  This is the real caller for `connectDrive` (specs.md §10.1/§10.4/§12).
- `RequireAuth.tsx` — route guard: unauthenticated → `WelcomeScreen`;
  authenticated with `driveOptIn === 'pending'` → `DrivePermissionScreen`;
  otherwise renders `children`.
- `errorCopy.ts` — maps a raw `AuthError`/`DriveError` message to the
  Spanish, actionable copy `WelcomeScreen`/`DrivePermissionScreen` actually
  render (`loginErrorCopy`, `driveErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7).

All three screens read `useAuthStore` (`@/lib/authStore`) for state; none
hold local auth state of their own. The Google account-chooser screen from
the design canvas is intentionally not built here — GIS's `initTokenClient`
shows Google's real chooser in its own popup.
