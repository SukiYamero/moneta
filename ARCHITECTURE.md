# KuroBello — architecture map

Lightweight index only: one line per top-level folder, linking to that
folder's own `README.md` for detail. For the conceptual architecture (stack,
data model, auth design, no-backend principle), see `specs.md` §1-§9 — this
file is just "where do I look", not "how does it work".

- `src/lib/` — shared stores, the Drive/auth/lock logic layer, the data-model
  contract. See [src/lib/README.md](src/lib/README.md).
- `src/features/` — one folder per screen/feature area, each with its own
  `README.md`: [auth](src/features/auth/README.md) (login + route guard),
  [boot](src/features/boot/README.md) (pre-content/boot UI),
  [history](src/features/history/README.md) (`/history`),
  [home](src/features/home/README.md) (`/` dashboard content),
  [lock](src/features/lock/README.md) (PIN/biometric lock UI),
  [movimientos](src/features/movimientos/README.md) (the movement sheet),
  [profile](src/features/profile/README.md) (the profile/account sheet),
  [search](src/features/search/README.md) (`/search` + filter sheet),
  [settings](src/features/settings/README.md) (`/settings`),
  [sync](src/features/sync/README.md) (first-run Drive download view),
  [tags](src/features/tags/README.md) (category picker + taxonomy).
- `src/components/ui/` — shadcn/ui primitives. See
  [src/components/ui/README.md](src/components/ui/README.md).
- `src/components/shared/` — cross-feature composed components
  (`BottomSheet`, `MovimientoRow`, …) built on top of `ui/`. See
  [src/components/shared/README.md](src/components/shared/README.md).
- `src/routes/` — route-level page components wired in `src/router.tsx`. See
  [src/routes/README.md](src/routes/README.md).
- `src/router.tsx` — the route table (React Router data router).
- `src/main.tsx` — app entry point (mounts `AppLock` + `RouterProvider`).
- `src/AppErrorBoundary.tsx` — top-level React error boundary; catches a
  render-time throw anywhere below it instead of white-screening the app.
- `src/RouteErrorFallback.tsx` — the router's `errorElement`, for a throw
  raised while resolving or rendering a route.
- `docs/ui/` — UI implementation plan + design-token rationale, sourced from
  the Claude Design project. See [docs/ui/README.md](docs/ui/README.md).
- `docs/waves.md` — the development-wave/track sequencing plan and worktree
  log (what's shipped, what's active, who owns what files). Separate from
  `specs.md`, which stays authoritative for behavior/decisions.

Update this file only when a top-level folder appears, disappears, or its
role fundamentally changes — not on every internal change. Internal detail
belongs in the folder's own `README.md` (see `AGENTS.md` § Directory docs).
