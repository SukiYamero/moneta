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
- `RequireAuth.tsx` — route guard, rebuilt for specs.md §10.29 (one loading
  moment, not two): `status === 'guest'` or `'authenticated'` render
  `children`/`DrivePermissionScreen` immediately, with no dependency on
  anything below. Below that, the render depends on `hasLoggedInBefore()`
  (`@/lib/deviceStore`) — read independently here, not inferred from
  `authStore.restore()`'s own internal check of the same marker (that
  module isn't owned by this track): `null` (still resolving — a real
  IndexedDB read, not a microtask) renders nothing at all, the one honestly
  unknown span; `true` renders `PreContentSkeleton`
  (`@/features/boot/PreContentSkeleton`) for as long as `restore()` is still
  running, then `ReturningUserScreen` once it settles without reaching
  `'authenticated'` (specs.md §10.21 — session genuinely lapsed); `false`
  renders `WelcomeScreen`, and — because that outcome is deterministic once
  known, restore() cannot land anywhere else for a marker-false device — as
  soon as it's known, not gated on `restore()` finishing too. The marker
  read is deliberately sequenced _before_ `restore()` is even called (not
  run in parallel with it): reading it first makes "returning flips true
  after `status` has already left `idle`" structurally impossible instead
  of merely unlikely — see `RequireAuth.tsx`'s own comment and the
  `guard: boot-flash regression` tests in `RequireAuth.test.tsx`. Offline
  (checked via `@/lib/networkStore`'s hint, no-lock boot path only):
  `restore()` skips the network call entirely and lands on `status:
'authenticated'` with `session`/`user` both `null` — handled by the same
  top branch as any other `'authenticated'` outcome, never reaching the
  returning-user check (`specs.md` §10.11). Guest entry: `WelcomeScreen`'s
  "Continuar como invitado" button calls `authStore.continueAsGuest()`,
  landing on the distinct `status: 'guest'` (never `'authenticated'` with a
  synthesized user) — checked first, before anything else.
- `ReturningUserScreen.tsx` — specs.md §10.21: greets by first name (device-
  local `profiles` registry, `@/lib/profiles`'s `listProfiles()` filtered to
  the most-recently-used `'google'`-kind record — never `getActiveProfile()`
  alone, which would resolve to a more-recently-touched guest/local profile
  if one exists), shows an account card (initials avatar, name, an expired
  chip on the `--warning` token — never the design export's literal
  untokenized hex) and one primary "Continuar como `<name>`" Google button;
  "Usar otra cuenta" is a second, differently-labeled call to the exact same
  `login()` — GIS's own popup is the real account chooser, this app has no
  separate one. No guest option, no value proposition, no legal copy.
  Degrades to a generic greeting/CTA (no name) when the registry has nothing
  yet or ever — never a blank. The reassurance line is worded to stay true
  whether or not local data actually survived ("si tenías datos guardados,
  siguen en este dispositivo"), not asserted unconditionally the way the
  export's mock copy does — the dishonest-UI class of defect §10.21 names
  explicitly.
- `errorCopy.ts` — maps a raw `AuthError`/`DriveError` message to a
  translation key in the `auth` namespace's `errors` group
  (`loginErrorCopy`, `driveErrorCopy`) — never the raw message
  (`docs/error-handling.md` §7). Stays a pure, i18next-free lookup;
  `WelcomeScreen`/`DrivePermissionScreen`/`ReturningUserScreen` resolve the
  key with `t()` at the render site, same as every other string on those
  screens.

All four screens read `useAuthStore` (`@/lib/authStore`) for state; none
hold local auth state of their own. The Google account-chooser screen from
the design canvas is intentionally not built here — GIS's `initTokenClient`
shows Google's real chooser in its own popup.
