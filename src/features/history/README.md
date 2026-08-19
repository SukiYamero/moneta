# src/features/history

- `HistoryScreen.tsx` — route-level screen mounted at `/history`
  (`src/router.tsx`, inside `RequireAuth`). Design has History as a
  full-screen overlay from the bottom nav; implemented as a real route
  entered with `animate-push-in` (not overlay-state-on-Home) so it reads as
  a native push (`AGENTS.md` § UI). Currently a minimal, honest placeholder
  (title + back link to `/`) — Track E4 (Wave 2 stage 3) replaces the body.
  Stable contract for that handoff: named export `HistoryScreen`, no props.
  Copy comes from the `history`/`common` i18n namespaces (`src/lib/i18n`).
