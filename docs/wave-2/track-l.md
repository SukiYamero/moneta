# Track L — app shell: bottom nav, routes, FAB — report

## Blocked: DesignSync unavailable this session

The brief says, verbatim: "If DesignSync is unavailable or unauthorised in
your session, stop and report that rather than inventing a nav from scratch
— I will pull it for you." That is exactly what happened.

- `ToolSearch` for `select:DesignSync`, then broader queries (`DesignSync
get_file`, `design sync file project artboard`, `claude design canvas
get_file write_files`, `get_file write_files project artboard dc.html
canvas`, `select:mcp__claude_ai_Design__get_file` and variants) returned
  no matching tool in any case. The deferred-tool listing surfaced in this
  session includes `mcp__claude_ai_Gmail__*`, `mcp__claude_ai_Google_Drive__*`,
  `mcp__claude_ai_Google_Calendar__*`, `mcp__playwright__*`,
  `mcp__google-search__search`, `mcp__sequential-thinking__*`, `WebFetch`,
  `WebSearch`, `Monitor`, `EnterWorktree`/`ExitWorktree`, `SendMessage`,
  `TaskStop`, `NotebookEdit` — no design tool at all.
- Checked for a cached snapshot in this worktree in case one could at least
  orient (not build from — the brief says pull fresh regardless): none
  exists (`find . -iname "*.dc.html"` empty, `git log --all` shows no design
  file ever committed).
- **Consequence: `BottomNav.tsx`, the FAB, and the real Home shell layout
  are not built.** Building them from guesswork would mean inventing the
  exact tab set, icon choice, and order that `docs/ui/implementation-plan.md`
  and `docs/ui/design-tokens.md` are explicit belong to the design file, not
  to this agent. I did not do that.

## What was built instead — everything in the brief that does not require the design file

The brief's routes (`/`, `/search`, `/history`, all inside `RequireAuth`,
each with `errorElement`), the `LockSettings` relocation, and the two
placeholder screens are all specified in the brief's own text, not derived
from the design canvas — so these are built and tested:

- **`src/router.tsx`** — added `/search` → `SearchScreen`, `/history` →
  `HistoryScreen`, both wrapped in `RequireAuth` with `RouteErrorFallback`,
  matching the existing `/` pattern exactly.
- **`LockSettings` moved off `Home` onto `/kit`** (`src/routes/Home.tsx`,
  `src/routes/Kit.tsx`). See "How I verified it still works" below —
  this was treated as non-negotiable and done regardless of the DesignSync
  block, since dropping it silently deletes a shipped feature
  (`docs/wave-2-plan.md` §3 item 1).
- **`src/features/search/SearchScreen.tsx`**, **`src/features/history/HistoryScreen.tsx`**
  — minimal, honest placeholders (title + back link to `/`, nothing fake).
  `HistoryScreen` uses `animate-push-in` per the brief's explicit
  instruction (independent of the design pull — the token and the "route,
  not overlay-state" decision are both already specified in the brief text).
  Both are named exports with no props — see "Handoff contract" below.
- **`nav` namespace**: left empty in all four locale files, as it started.
  Adding nav labels without knowing the real tab set would be the same
  invented-nav problem in a different file.
- **`search`/`history` namespaces**: seeded with the placeholder screens'
  own copy (`title`, `placeholder`) — real content Track L's own files need,
  not invented UI structure. `common.back` added for the shared back-link
  label both screens use. All four locale files kept key-identical (checked
  via `bun run test` — `resources.test.ts` — see output below).
- **`src/components/shared/index.ts`**: **not touched.** The brief asks for
  one export line for `BottomNav`, which does not exist. Appending nothing
  would be a no-op diff; appending anything else would not match the brief.

## How I verified LockSettings still works at `/kit`

Two ways, both real:

1. **New `src/routes/Kit.test.tsx`** renders `<Kit />` (unmocked, real
   `useLockStore`) and asserts the "Activar lock" button — the disabled-state
   entry point — is present. `LockSettings`' own full behavior (enable,
   re-lock, error copy) is already covered end-to-end by the pre-existing
   `src/features/lock/LockSettings.test.tsx`, untouched by this move — same
   component, same tests, new mount point.
2. **Old assertion removed correctly, not just deleted**: `Home.test.tsx`
   previously asserted `/activar lock/i` rendered on `Home`; I moved that
   assertion (in spirit — the real one is more direct, per point 1) rather
   than dropping test coverage for the feature. Ran both files together
   before touching anything else (`bunx vitest run src/routes/Home.test.tsx
src/routes/Kit.test.tsx`) — 2/2 passed — before proceeding to the rest of
   the track.

## Handoff contract for Track E3 / Track E4 (next stage)

```ts
// src/features/search/SearchScreen.tsx
export const SearchScreen = () => { … } // no props
// src/features/history/HistoryScreen.tsx
export const HistoryScreen = () => { … } // no props
```

Both are wired into `src/router.tsx` by name already — E3/E4 replace the
function body only; the export name, the route path, and the
`RequireAuth`/`errorElement` wrapping in `router.tsx` do not need to change.

## Decisions made (for specs.md §11)

- **Routing model confirmed as three sibling top-level routes** (`/`,
  `/search`, `/history`), not a nested layout route with an `<Outlet>` for
  a shared `BottomNav`. This was an open question I did not resolve, because
  resolving it requires knowing from the design whether `BottomNav` renders
  on all three screens or only some (History is a full-screen overlay —
  plausibly nav-less) — see "Open questions" below. `router.tsx` as it
  stands works either way: a layout route wrapping the three children can
  be introduced later without changing any of `SearchScreen`/`HistoryScreen`/
  `Home`'s own code.

## Backlog / deferred (for specs.md §12)

- **`BottomNav.tsx` + test, the FAB, and the real `Home.tsx` shell — not
  built.** Blocked on the DesignSync pull described above. Once the design
  is available: map its Phosphor icons 1:1 to Lucide
  (`docs/ui/design-tokens.md`), decide whether `BottomNav` wraps all three
  routes via a shared layout route or is rendered per-screen, and whether
  `Search`/`History` show the nav at all (History reads as a full-screen
  push in the brief, which is often nav-less in native apps — needs the
  actual design, not a guess).
- **`nav` namespace stays empty.** Fill it when `BottomNav` is built, in the
  same change (tab labels are visual/structural content, not usable before
  the tab set is known).
- **`src/components/shared/index.ts` `BottomNav` export — not added.**
  Whoever builds `BottomNav.tsx` next appends the one line the brief
  originally asked for.

## Doc lines to add (say exactly which file and where)

**`src/routes/README.md`** (operator-owned this wave, not edited directly)
— update the `Home.tsx` bullet from:

> `Home.tsx` — the only production route right now; hosts `LockSettings` as
> a dev harness. Will host the dashboard/movimientos entry points once
> those land.

to:

> `Home.tsx` — placeholder shell for `/`; the real bottom-nav/FAB/dashboard
> shell is blocked on a DesignSync pull (`docs/wave-2/track-l.md`).
> `LockSettings` moved to `Kit.tsx` (see below) — it is no longer here.

and update the `Kit.tsx` bullet from:

> `Kit.tsx` — dev-only gallery for `src/components/shared/**`, mounted at
> `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx` (not part of
> the production build's routes). See `specs.md` §10.5.

to:

> `Kit.tsx` — dev-only gallery for `src/components/shared/**`, mounted at
> `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx` (not part of
> the production build's routes). See `specs.md` §10.5. Also hosts
> `LockSettings` — the only way to enable/disable the PIN lock (moved off
> `Home` when the app shell was rebuilt).

Add a new bullet for the two new sibling routes:

> `/search` and `/history` (`src/features/search/SearchScreen.tsx`,
> `src/features/history/HistoryScreen.tsx`) — see those folders' own
> `README.md`s. Currently minimal placeholders replaced in Wave 2 stage 3.

## Spec deltas (anything where the brief below turned out wrong)

None found in the parts I could build. The brief's route list, the
`LockSettings` move, the placeholder-screen contract, and the
`animate-push-in` choice for History all held up as specified. The one
place I diverged from "build it" is entirely the DesignSync unavailability,
not a disagreement with the brief's design.

## Open questions for the operator

1. **Does `BottomNav` render on `Search` and/or `History`, or only `Home`?**
   `docs/ui/implementation-plan.md` lists "Bottom nav + FAB" only under the
   Home screen's bullet list, and History is described as a full-screen
   overlay (commonly nav-less in native apps), but neither statement is
   conclusive without the actual design. Worth confirming alongside the
   DesignSync pull so the next session doesn't have to re-derive it from a
   layout guess.
2. **Should the three routes move to a shared layout route (`<Outlet>`) once
   `BottomNav` exists**, rather than three siblings each independently
   wrapped in `RequireAuth`? I left them as siblings since that is what the
   brief specifies verbatim ("Routes: `/` (Home), `/search`, `/history` —
   all inside `RequireAuth`"), but a layout route would be the natural place
   to mount a shared `BottomNav` once it exists, if question 1 says all
   three need it. Flagging so it isn't silently decided either way in the
   next session without being noticed as a routing-model change.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/shell


 Test Files  43 passed (43)
      Tests  401 passed (401)
   Start at  02:05:53
   Duration  7.09s (transform 1.54s, setup 8.42s, import 11.51s, tests 8.68s, environment 24.64s)
```

The one lint warning is pre-existing in `src/components/ui/button.tsx`
(shadcn-generated, outside this track's scope — untouched by this diff).
