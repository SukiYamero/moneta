# src/routes

Route-level page components, wired into `src/router.tsx`.

- `Home.tsx` — the only production route right now; hosts `LockSettings` as
  a dev harness. Will host the dashboard/movimientos entry points once
  those land.
- `Kit.tsx` — dev-only gallery for `src/components/shared/**`, mounted at
  `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx` (not part
  of the production build's routes). See `specs.md` §10.5.
