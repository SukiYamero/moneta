# src/routes

Route-level page components, wired into `src/router.tsx`.

- `AppShell.tsx` — the layout route wrapping `/`, `/search` and `/history`
  (`<Outlet />`). Renders `BottomNav` once so it's persistent across all
  three tabs, plus `ProfileSheet`, `AddMovimientoSheet` and `MovimientoSheet`
  (owns the profile sheet's open state locally; the add/edit sheets read
  `useMovimientoSheetStore`).
- `Home.tsx` — the `/` screen's content, rendered inside `AppShell`'s
  `<Outlet />`. Composed from `src/features/home/**` — see that directory's
  `README.md`.
- `Kit.tsx` — dev-only component gallery for `src/components/shared/**`,
  mounted at `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx`
  (not part of the production build's routes). Code-split via `KitLazy.tsx`.

The other bottom-nav screens live with their features, not here:
`src/features/search/SearchScreen.tsx` and
`src/features/history/HistoryScreen.tsx`. `/settings`
(`src/features/settings/SettingsScreen.tsx`) is a separate top-level route,
not nested under `AppShell` (no `BottomNav`), wrapped in `RequireAuth` at
the router level and code-split via `SettingsLazy.tsx`.
