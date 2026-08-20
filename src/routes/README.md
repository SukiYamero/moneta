# src/routes

Route-level page components, wired into `src/router.tsx`.

- `AppShell.tsx` — the layout route wrapping `/`, `/search` and `/history`.
  Renders `BottomNav` once and a scrollable `<Outlet />` for the active
  screen: the nav is persistent across all three tabs (the design layers it
  above both screen overlays), so remounting it per tab would flash and
  break the native feel the `--ease-ios` transitions exist to create.
- `AppShell.tsx` also owns the profile sheet's `open` state and renders
  `<ProfileSheet>` (`src/features/profile`) alongside `BottomNav` — the
  shared nav takes `profileOpen`/`onOpenProfile` as props so
  `src/components/shared/**` never imports a feature.
- `Home.tsx` — the `/` screen's content, rendered inside `AppShell`'s
  `<Outlet />`: the dashboard (greeting, balance, week strip, weekly chart,
  recent movements) composed from `src/features/home/**`. See that
  directory's own `README.md` for the pieces.
- `Kit.tsx` — dev-only gallery for `src/components/shared/**`, mounted at
  `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx` (not part
  of the production build's routes). See `specs.md` §10.5. `LockSettings` no
  longer lives here — it moved to
  `src/features/profile/SecuritySection.tsx` (`specs.md` §10.18, Wave 3
  stage 3), so the PIN vault is configurable in every build rather than only
  at `/kit` in dev.

The two screens reached from the nav live with their features, not here:
`src/features/search/SearchScreen.tsx` and
`src/features/history/HistoryScreen.tsx`. Same for `/settings` —
`src/features/settings/SettingsScreen.tsx`, wrapped in `RequireAuth` at the
router level (not nested under `AppShell`: it's a route, not a bottom-nav
tab, so it doesn't carry `BottomNav`) and code-split via
`SettingsLazy.tsx` (mirrors `KitLazy.tsx`'s `React.lazy` + the shared
`ScreenLoading` `Suspense` fallback, specs.md §10.24).
