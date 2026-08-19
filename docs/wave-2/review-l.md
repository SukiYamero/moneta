# Review — Track L (app shell)

Completed by the operator after the review agent's run was cut short three
times by an infrastructure failure (the machine sleeping mid-response). The
analysis and code below are the agent's, verified and committed by the
operator; the agent never got to write this file itself.

## Findings

### 1. CONFIRMED — the scroll pane's nav clearance was a hardcoded duplicate

`AppShell` reserved `pb-30` (a static 7.5rem) for the bottom nav while
`BottomNav` and `Toaster` both size off `--bottom-nav-clearance`
(`src/styles/index.css`). Two problems:

- It is a third copy of a value the token exists to hold once. The operator
  introduced that token at integration precisely to stop this, fixed
  `BottomNav` and `Toaster`, and **missed this call site** — an incomplete
  sweep of exactly the shape `AGENTS.md` warns about.
- The numbers do not even agree. The nav is `6rem + env(safe-area-inset-bottom)`;
  the pane reserved a flat `7.5rem`. On a device with a home indicator the
  static value falls short of the nav's real height, so the last row of any
  screen sits under the bar.

Fixed: `pb-(--bottom-nav-clearance)`. Test asserts the class is the token
rather than a literal, so a future hardcode fails the build.

### 2. CONFIRMED by test — a screen crash does not take the nav down

`src/router.tsx` gives each child route its own `errorElement` so that one
screen throwing leaves the persistent nav mounted. That is a claim about
runtime behaviour that reading the router table cannot settle — react-router's
per-segment error boundaries are a fact about react-router, not about this
codebase. Proven directly: a child that throws during render renders the
fallback while `role="navigation"` stays in the document.

## Open for the operator

`SearchScreen` also pads with `pb-(--bottom-nav-clearance)` on its own
`<main>`, on top of the pane's. With finding 1 fixed that is now double
clearance on that one screen. Home and History rely on the pane alone. The
clearance belongs in exactly one place — the pane, which owns both the scroll
container and the nav — so Search's own padding should go. Not done here:
another reviewer held that file at the time.
