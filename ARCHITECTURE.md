# KuroBello — architecture map

Lightweight index only: one line per top-level folder, linking to that
folder's own `README.md` for detail. For the conceptual architecture (stack,
data model, auth design, no-backend principle), see `specs.md` §1-§9 — this
file is just "where do I look", not "how does it work".

- `src/lib/` — shared stores, the Drive/auth/lock logic layer, the data-model
  contract. See [src/lib/README.md](src/lib/README.md).
- `src/features/auth/` — login screen + route guard. See
  [src/features/auth/README.md](src/features/auth/README.md).
- `src/features/lock/` — PIN/biometric lock UI. See
  [src/features/lock/README.md](src/features/lock/README.md).
- `src/components/ui/` — shadcn/ui primitives. See
  [src/components/ui/README.md](src/components/ui/README.md).
- `src/routes/` — route-level page components wired in `src/router.tsx`. See
  [src/routes/README.md](src/routes/README.md).
- `src/router.tsx` — the route table (React Router data router).
- `src/main.tsx` — app entry point (mounts `AppLock` + `RouterProvider`).

Update this file only when a top-level folder appears, disappears, or its
role fundamentally changes — not on every internal change. Internal detail
belongs in the folder's own `README.md` (see `AGENTS.md` § Directory docs).
