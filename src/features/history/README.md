# src/features/history

- `HistoryScreen.tsx` — route-level screen mounted at `/history` as a
  child of the `AppShell` layout route (`src/router.tsx`, inside
  `RequireAuth`). Design has History as a full-screen overlay from the
  bottom nav; implemented as a real route entered with `animate-push-in`
  (not overlay-state-on-Home) so it reads as a native push (`AGENTS.md`
  § UI, design source `mnPushIn .28s cubic-bezier(.32,.72,0,1)`). Currently
  a minimal, honest placeholder (title only) — Track E4 (Wave 2 stage 3)
  replaces the body. Stable contract for that handoff: named export
  `HistoryScreen`, no props. No back affordance: `BottomNav`
  (`src/components/shared/BottomNav.tsx`, mounted once by `AppShell`) is
  how the user returns to Home — History is a sibling tab, not a screen
  pushed on top of Home. Copy comes from the `history` i18n namespace
  (`src/lib/i18n`).
