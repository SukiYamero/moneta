# src/routes

Route-level page components, wired into `src/router.tsx`.

- `AppShell.tsx` — the layout route wrapping `/`, `/search` and `/history`.
  Renders `BottomNav` once and a scrollable `<Outlet />` for the active
  screen: the nav is persistent across all three tabs (the design layers it
  above both screen overlays), so remounting it per tab would flash and
  break the native feel the `--ease-ios` transitions exist to create.
- `Home.tsx` — the `/` screen's content, rendered inside `AppShell`'s
  `<Outlet />`: the dashboard (greeting, balance, week strip, weekly chart,
  recent movements) composed from `src/features/home/**`. See that
  directory's own `README.md` for the pieces.
- `Kit.tsx` — dev-only gallery for `src/components/shared/**`, mounted at
  `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx` (not part
  of the production build's routes). See `specs.md` §10.5. Also hosts
  `LockSettings`, the only UI that can enable, disable or manually re-lock
  the PIN vault — it moved here off `Home` when the shell was rebuilt, so
  rebuilding Home's content cannot silently delete the feature. Its real
  production home is the profile/account sheet (`specs.md` §10.18, not yet
  built).

The two screens reached from the nav live with their features, not here:
`src/features/search/SearchScreen.tsx` and
`src/features/history/HistoryScreen.tsx`.
