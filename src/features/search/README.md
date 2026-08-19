# src/features/search

- `SearchScreen.tsx` — route-level screen mounted at `/search` as a child
  of the `AppShell` layout route (`src/router.tsx`, inside `RequireAuth`).
  Currently a minimal, honest placeholder (title only) — Track E3 (Wave 2
  stage 3) replaces the body. Stable contract for that handoff: named
  export `SearchScreen`, no props. No back affordance: `BottomNav`
  (`src/components/shared/BottomNav.tsx`, mounted once by `AppShell`) is
  how the user returns to Home — Search is a sibling tab, not a screen
  pushed on top of Home. Enters with `animate-fade-in` per the design
  source (`mnFade .2s ease`, distinct from History's push). Copy comes from
  the `search` i18n namespace (`src/lib/i18n`).
