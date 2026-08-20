# src/features/boot

The boot sequence's UI (`specs.md` §10.28): what a signed-in or guest user
sees between "auth resolved" and "the app is actually usable." The
sequencing logic itself (`src/lib/boot.ts`'s `useBootStore`) lives in
`src/lib/`, not here — this folder is presentation only.

- `BootGate.tsx` — wraps the protected app content (`src/router.tsx`, inside
  both `RequireAuth` usages) and drives `useBootStore.run()`. Renders
  `BootScreen` while booting, `BootErrorScreen` on failure, `children` once
  ready. Owns the ~800ms brand-moment floor: a genuine first boot (or a
  rebind after switching accounts) holds `BootScreen` for at least that
  long, but a remount that finds boot already `'ready'` (e.g. navigating
  from `/` to `/settings`, separate top-level routes) renders `children`
  instantly — never re-showing the brand screen per-navigation.
- `BootScreen.tsx` — the brand moment itself. No logo yet
  (`docs/pendientes-usuario.md` item 8): built from `APP_NAME`
  (`src/lib/branding.ts`) and the existing gradient-mark/type tokens
  `ScreenLoading` already uses for Tier 1 loading, so a real mark drops in
  later by replacing one square's content, not by restructuring the screen.
- `BootErrorScreen.tsx` — the honest failure §10.28 requires when the local
  database can't be opened (private mode, denied storage, quota) — full-
  screen, styled after `HomeErrorState`'s card treatment, with a retry that
  calls `run()` again. Never a white screen, never a silent fallback to the
  fake repo.

No barrel — both call sites (`src/router.tsx`) import `BootGate` directly,
matching `src/features/auth/`'s own convention for a small feature folder.
