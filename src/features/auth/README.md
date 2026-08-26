# src/features/auth

Onboarding screens and the route guard that sits in front of the app.

- `RequireAuth.tsx` — route guard. `status === 'guest'` renders `children`
  directly. `status === 'authenticated'` renders `DrivePermissionScreen` if
  `driveOptIn === 'pending'`, otherwise `children` plus `GuestAdoptionPrompt`.
  Otherwise, resolves whether this device has been used before
  (`@/lib/deviceStore`'s `hasLoggedInBefore`/`hasUsedGuestBefore`) and renders:
  nothing while unknown, `PreContentSkeleton` while a returning device's
  `restore()` is still running, `ReturningUserScreen` once settled without
  reaching `authenticated`/`guest`, or `WelcomeScreen` for a new device.
- `WelcomeScreen.tsx` — primary "Continuar con Google" CTA
  (`GoogleSignInButton`) plus a "Continuar como invitado" CTA
  (`GuestSignInButton`, calls `authStore.continueAsGuest()` directly).
- `ReturningUserScreen.tsx` — greets by first name, read from the
  most-recently-used `'google'`-kind record in `@/lib/profiles`'
  `listProfiles()`. Shows an account card and two actions: "Continuar como
  `<name>`" (`authStore.login()`) and "Continuar como invitado", which opens a
  `ConfirmDialog` before calling `continueAsGuest()`. Degrades to a generic
  greeting when no profile record exists yet.
- `DrivePermissionScreen.tsx` — shown once per authenticated session before
  the app. "Permitir y continuar" calls `authStore.connectDrive()`; "Ahora
  no" calls `authStore.dismissDrive()`.
- `GuestAdoptionPrompt.tsx` — a `CenterModal` rendered alongside `children`
  (not a full-screen gate) offering to move a local/guest profile's data
  under a newly signed-in Google account. Gated on `authStore.ts`'s
  `pendingAdoption`. "Yes" calls `acceptGuestAdoption()`; "No" calls
  `declineGuestAdoption()`.
- `GoogleSignInButton.tsx` / `GuestSignInButton.tsx` — shared CTA surfaces
  used by both `WelcomeScreen` and `ReturningUserScreen`; callers own the
  click handler and label.
- `errorCopy.ts` — maps a raw `AuthError`/`DriveError` to an i18next key in
  the `auth` namespace's `errors` group.

All screens read `useAuthStore` (`@/lib/authStore`) directly; none hold local
auth state of their own.
