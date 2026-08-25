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
  anything below (the `'authenticated'` branch also renders
  `GuestAdoptionPrompt` alongside `children` once `driveOptIn` is resolved
  — specs.md §10.32, that component's own entry below has the detail). Below that, the render depends on "has this device been
  used before" — `hasLoggedInBefore() || hasUsedGuestBefore()`
  (`@/lib/deviceStore`, both read independently here via one `Promise.all`,
  not inferred from `authStore.restore()`'s own internal checks of the same
  two markers, specs.md §10.33): `null` (either read still resolving — two
  real IndexedDB reads, not a microtask) renders nothing at all, the one
  honestly unknown span; `true` renders `PreContentSkeleton`
  (`@/features/boot/PreContentSkeleton`) for as long as `restore()` is still
  running, then either `status === 'guest'` (top branch, a returning guest —
  `restore()`'s own guest branch) or `ReturningUserScreen` once it settles
  without reaching `'authenticated'`/`'guest'` (specs.md §10.21 — an account
  session genuinely lapsed; the account marker is what makes this fallback
  correct even though the combined boolean can't tell the two markers
  apart, since `restore()`'s guest branch only ever runs — and always
  succeeds, short-circuited by the top-level `status === 'guest'` check —
  when the account marker is absent); `false` renders `WelcomeScreen`, and —
  because that outcome is deterministic once known, restore() cannot land
  anywhere else for a device with neither marker — as soon as it's known,
  not gated on `restore()` finishing too. The two marker reads are
  deliberately sequenced _before_ `restore()` is even called (not run in
  parallel with it, though they run in parallel with _each other_): reading
  them first makes "returning flips true after `status` has already left
  `idle`" structurally impossible instead of merely unlikely — see
  `RequireAuth.tsx`'s own comment and the `guard: boot-flash regression`
  tests in `RequireAuth.test.tsx` (extended with a returning-guest variant,
  specs.md §10.33). Offline (checked via `@/lib/networkStore`'s hint,
  no-lock boot path only): `restore()` skips the network call entirely and
  lands on `status: 'authenticated'` with `session`/`user` both `null` —
  handled by the same top branch as any other `'authenticated'` outcome,
  never reaching the returning-user check (`specs.md` §10.11). Guest entry:
  `WelcomeScreen`'s "Continuar como invitado" button calls
  `authStore.continueAsGuest()`, landing on the distinct `status: 'guest'`
  (never `'authenticated'` with a synthesized user) — checked first, before
  anything else. A **returning** guest reaches the same status through
  `restore()`'s guest branch instead (`@/lib/authStore`'s own entry has the
  detail) — `RequireAuth` itself needed no new branch for this, since
  `status === 'guest'` was already checked first for every entry path.
  A synchronous `localStorage` mirror of either marker (the pattern
  `@/lib/theme.ts` uses for the theme, so first paint doesn't wait on
  IndexedDB) was considered and **not built**: `AppLock` already blanks the
  screen for its own, separate, unavoidable reason (`lockStore.init()`'s
  vault check) _before_ this component even mounts, so mirroring here would
  only shave the smaller of two stacked blank frames while doubling the
  drift-prone surface (two mirrored keys instead of one, cleared across
  more write paths) — see specs.md §11, 2026-08-20 for the full reasoning.
- `ReturningUserScreen.tsx` — specs.md §10.21/§10.37: greets by first name
  (device-local `profiles` registry, `@/lib/profiles`'s `listProfiles()`
  filtered to the most-recently-used `'google'`-kind record — never
  `getActiveProfile()` alone, which would resolve to a more-recently-touched
  guest/local profile if one exists), shows an account card (initials
  avatar, name, an expired chip on the `--warning` token — never the design
  export's literal untokenized hex) and **two** actions: the primary
  "Continuar como `<name>`" Google button, and a secondary "Continuar como
  invitado" button. specs.md §10.36 removed a second "Usar otra cuenta"
  button that used to sit below it — it called the exact same `login()` as
  the primary, so it was one control promising a different outcome and
  delivering the identical one, and §10.36 rejected replacing it with guest
  entry at the time. §10.37 (user decision, later the same day) un-rejects
  guest specifically, on a reason §10.36 didn't have: Google's own sign-in
  already opens an account chooser, so "use another account" was never a
  genuinely distinct action — guest is. The button never calls
  `continueAsGuest()` directly: it opens a `ConfirmDialog`
  (`@/components/shared`) first, whose copy states only what actually
  happens (a separate, device-only profile; this account's data untouched;
  reachable again via the profile switcher, §10.31) — never a value
  proposition or legal copy, which is the part of §10.21's original ban that
  still holds. A genuinely distinct third action (forcing Google's account
  chooser via GIS's `select_account` prompt) remains possible in principle
  but needs `src/lib/auth.ts`/`src/lib/authStore.ts` changes outside this
  track's file ownership — still escalated, not built here.
  Degrades to a generic greeting/CTA (no name) when the registry has nothing
  yet or ever — never a blank. The reassurance line ("volver a iniciar
  sesión no toca lo que ya está guardado en este dispositivo") claims only
  what signing back in does, never what state local storage is currently
  in — the marker only proves a session once existed, not that data
  survived (a browser can evict IndexedDB), so a line that asserts survival
  ("si tenías datos guardados, siguen en este dispositivo") is unsafe even
  phrased conditionally: it is false in exactly the eviction case §10.21
  warns about. This is the dishonest-UI class of defect §10.21 names
  explicitly, and the reason it isn't gated on an actual local-data check is
  that the screen has no repo access yet at this point in boot (§10.21's own
  blast radius keeps this track out of `dataStore`).
- `GuestAdoptionPrompt.tsx` — specs.md §10.32: asked once, at first sign-in,
  when the local/guest profile has movements and the device hasn't already
  declined (`authStore.ts`'s `pendingAdoption`, set inside `login()`). Not
  a full-screen gate like `DrivePermissionScreen` above — `RequireAuth`
  renders it _alongside_ `children`, as a `CenterModal` over the already-
  settled app, since Home is real and usable underneath while the person
  decides. Renders nothing when there is no pending offer. "Yes" calls
  `authStore.acceptGuestAdoption()` (busy state via `adoptionBusy`, an
  error via `adoptionError` that keeps the offer open for a retry rather
  than dismissing it); "No" calls `declineGuestAdoption()`, which touches
  nothing local — only records the device won't be asked again.
  `acceptGuestAdoption()` also persists the consent itself
  (`deviceStore.ts`'s `adoptionConsent`, `specs.md` §11 2026-08-21) before
  the move starts — what lets `boot.ts` finish the move silently on a later
  boot if this tab closes mid-move, with no second prompt. There is
  no design for this screen (verified against the export — the canvas's
  "Usar estos datos" belongs to the receipt-scan flow), built from
  `CenterModal` and the tokens, same posture as §10.2.1's biometric row.
- `GoogleSignInButton.tsx` — the shared white/G-mark button surface both
  `WelcomeScreen` and `ReturningUserScreen` render for their primary CTA
  (busy label swap included), so the one Google-branded control in the app
  has one definition instead of two independently hand-rolled copies.
- `GuestSignInButton.tsx` — the shared secondary "continue as guest" CTA,
  extracted for the same reason and by the same precedent as
  `GoogleSignInButton` above once its `className` turned up byte-identical
  between the two screens (`specs.md` §10.40). Takes `onClick`/`disabled`/
  `children` only — the two callers still differ in what a click does
  (`WelcomeScreen` enters guest mode directly, `ReturningUserScreen` opens
  a `ConfirmDialog` first) and in label copy, both of which stay the
  caller's job.
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
