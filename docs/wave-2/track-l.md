# Track L — app shell: bottom nav, routes, FAB — report

## Timeline

1. First pass: `DesignSync` unavailable in this session (confirmed via
   `ToolSearch` — `select:DesignSync` and several broader queries all came
   back empty; the deferred-tool listing had no design tool at all). Per the
   brief, stopped rather than inventing a nav, built only what the brief's
   own text specifies (routes, `LockSettings` move, placeholder screens),
   and reported the blocker.
2. The operator pulled the design themselves (`DesignSync` is
   operator-only in this setup) and dropped the full source at
   `Moneta.dc.html` on disk, with the bottom-nav structure paraphrased and
   two brief corrections: the centre button is not a separate FAB, it's the
   nav's third slot; and the nav is persistent across all three tabs, not
   Home-only. **Read the actual source directly before building**
   (`grep`/`sed` on the file, not just the paraphrase) — confirms below.
3. Built `BottomNav`, `AppShell` (the layout route the persistent-nav
   requirement forces — see "Restated handoff contract" below), rewired
   `router.tsx`, fixed `SearchScreen`/`HistoryScreen` to match (no back
   link, correct enter animation per screen), filled the `nav` namespace,
   removed the now-unused `common.back` key.

## What the design source actually says (verified by reading it directly)

Confirmed the operator's paraphrase against `Moneta.dc.html` directly
(`grep`/`sed`, not trusted secondhand):

- **Bottom nav**, line ~172: five slots, `justify-content: space-between`.
  Home (`ph-house`/`ph-fill ph-house`) → `goHome`, History
  (`ph-clock-counter-clockwise`/fill) → `goHistory`, centre Add
  (`ph-bold ph-plus`, 58×58, `border-radius:20px`,
  `margin-top:-18px`) → `openSheet`, Search
  (`ph-magnifying-glass`/fill) → `goSearch`, Profile (`ph-user`, no active
  variant) → `openProfile`.
- **State bindings**, line ~2806-2811 (class component): `navHome`/
  `navHistory`/`navSearch` are `'#2FD896'` when `state.tab` matches, else
  `'#5A5D64'`; the icon class swaps `ph` → `ph-fill` the same way. Profile's
  color and icon are hardcoded, never green — it has no active state by
  design, not by omission.
- **Layout**: nav height 96px, padding `0 24px 22px`, icon font-size 26px,
  label 10px/weight 600, gap 3px, background
  `linear-gradient(to top,#0C0D10 60%,rgba(12,13,16,.92) 88%,transparent)`,
  `z-index:19`.
- **History overlay**, line ~196: `position:absolute; inset:0; z-index:18;
animation:mnPushIn .28s cubic-bezier(.32,.72,0,1)`.
- **Search overlay**, line ~353: same `z-index:18`,
  `animation:mnFade .2s ease` — a fade, not a push. This is a real
  correction to my own earlier build (see "Spec deltas" below): I had
  applied `animate-push-in` to neither screen in the pre-design pass and
  hadn't yet distinguished the two; Search now gets `animate-fade-in`
  (already an existing token, `fade-in 0.2s ease` — an exact match to
  `mnFade`), History keeps `animate-push-in`.
- **Home header bell**, line ~59-62: renders a permanent green dot
  (`background:#2FD896`) next to the bell icon, unconditionally — no
  binding gates it. See "The notification dot" below.

Color/token mapping, confirmed against `src/styles/index.css`'s `.dark`
block rather than assumed: `#2FD896` = `--primary` exactly (also
`--success-strong`), `#5A5D64` = `--fg-disabled` exactly (not
`--muted-foreground`, which is `#85888F`/`--fg-tertiary`-adjacent — the
design's inactive nav color is specifically the disabled tier, confirmed by
grepping the hex, not assumed from the operator's paraphrase alone),
`#0C0D10` = `--background`/`--canvas`.

## What was built

- **`src/components/shared/BottomNav.tsx`** (+ `.test.tsx`) — the five
  slots. Home/History/Search are real `NavLink`s (`aria-current="page"`
  comes from `NavLink` itself, not hand-rolled); active state uses
  `text-primary` + heavier `strokeWidth` (2.5 vs 2) since Lucide has no
  filled variant (`docs/ui/design-tokens.md`). Centre Add and Profile are
  `disabled` buttons with `aria-label` and `// STUB(trackF)`/
  `// STUB(trackG)` comments — visually complete, functionally inert, per
  the STUB convention (`docs/ui/implementation-plan.md`), not silently
  dead. Icon mapping: `ph-house`→`House`, `ph-clock-counter-clockwise`→
  `History`, `ph-bold ph-plus`→`Plus`, `ph-magnifying-glass`→`Search`,
  `ph-user`→`User` — five direct 1:1 Lucide equivalents, no gaps.
  Every design measurement converted to the existing token/spacing scale,
  not copied as raw px (`bun run lint:units` enforces this): 96px height →
  `h-24` (exact rem match), 26px icon → `size-6.5` (26px exact), 58×58 FAB →
  `size-14.5` (58px exact), `border-radius:20px` → `rounded-3xl`
  (`--radius-3xl` is exactly 20px), `margin-top:-18px` → `-translate-y-4.5`
  (18px exact), 3px gap → `gap-0.75` (3px exact), 24px horizontal padding →
  `px-6` (Tailwind default, exact), 10px label → `text-2xs` (the token is
  defined as exactly 10px). 22px bottom padding replaced with
  `pb-[calc(env(safe-area-inset-bottom)+1.375rem)]` per the brief (real
  home-indicator clearance instead of the prototype's fixed stand-in).
  **Verified these aren't dead utility names**: built `dist/` and grepped
  the generated CSS for each exact selector (`size-6\.5`, `size-14\.5`,
  `gap-0\.75`, `-translate-y-4\.5`) — all five resolved to the expected
  `calc(var(--spacing) * N)` rules with the exact pixel values above, not
  silently-unmatched classes.
- **`src/routes/AppShell.tsx`** (+ `.test.tsx`) — new layout route:
  `<Outlet />` in a scrollable flex-1 container, `<BottomNav />` fixed
  below it. Exists because the nav is persistent across all three tabs
  (see "Restated handoff contract").
- **`src/router.tsx`** — restructured to a pathless layout route
  (`RequireAuth` + `AppShell`) with three children: `index: true` → `Home`,
  `/search` → `SearchScreen`, `/history` → `HistoryScreen`. The layout
  route keeps its own `errorElement` (catches a failure in
  `RequireAuth`/`AppShell` itself); each child keeps its own too, so one
  screen crashing doesn't take the persistent nav down with it — strictly
  more resilient than the flat structure it replaces, not a regression.
  `/kit` stays outside this tree, untouched.
- **`SearchScreen.tsx`/`HistoryScreen.tsx`** — dropped the back-link header
  built in the pre-design pass (wrong once the nav turned out to be
  persistent — see "Spec deltas"). Search now uses `animate-fade-in`,
  History keeps `animate-push-in`. Same stable no-props export contract as
  before.
- **`nav` namespace** filled in all four locale files: `label`, `home`,
  `history`, `search`, `profile`, `add`. `common.back` removed (dead once
  the back-link header was dropped — no orphaned translation left behind).
- **`src/components/shared/index.ts`** — added the `BottomNav` export line
  (the accepted one-line conflict with Track K, kept to exactly one line).

## Restated handoff contract (this changed from the first report)

```ts
// src/features/search/SearchScreen.tsx
export const SearchScreen = () => { … } // no props
// src/features/history/HistoryScreen.tsx
export const HistoryScreen = () => { … } // no props
```

Export names/props are unchanged from the first report. **What changed**:
these are no longer routed directly under `RequireAuth` — they are children
of `AppShell` (`src/routes/AppShell.tsx`), which renders `<BottomNav />`
once and an `<Outlet />` for them. Concretely, for Track E2/E3/E4:

- **Don't render your own back/nav chrome.** `BottomNav` is already
  mounted by `AppShell` and stays mounted across all three tabs — the
  operator confirmed this from the design's z-index layering (nav at 19,
  both overlays at 18, painted underneath). Building a second nav or a back
  button in your screen would duplicate it.
- **Your screen's root element does not need `min-h-dvh` and should not
  assume it owns the full viewport** — you're rendered inside `AppShell`'s
  scrollable content pane (`flex-1 overflow-y-auto pb-30`, 120px reserved
  at the bottom so content doesn't sit under the fixed nav). `min-h-full`
  is the right base, matching what `Home.tsx` already does.
- **Enter animation is per-screen, not shared**: History uses
  `animate-push-in`, Search uses `animate-fade-in` — confirmed from the
  design source's own `mnPushIn`/`mnFade` keyframe names on each overlay,
  not a single choice applied to both.
- Route paths/wiring in `router.tsx` are otherwise unchanged — E2/E3/E4
  don't touch `router.tsx` at all.

## The notification dot — my view (Home content is Track E2's, not mine)

The design source (line ~59-62) renders the bell's green dot
unconditionally — there is no `sc-if`/binding gating it; it is not a
"badge count > 0" indicator, it's a static decoration in the prototype.
That is a meaningfully different fact than "the design shows a dot," which
is how the operator's message summarized it.

I agree with the operator's brief to E2 (no dot), and more strongly than
"lean toward": a permanently-lit unread indicator with nothing feeding it
is not a neutral placeholder the way the FAB is. A disabled FAB accurately
represents its own state — tapping it does nothing, and it looks like it
does nothing (or at least "not yet"). An always-on unread dot asserts a
fact ("something new happened") that is never true, with no way for it to
ever become false. That is a UI lie in the specific way
`docs/error-handling.md`'s "never render fake data / never show a success
you didn't get" principle is aimed at — same shape of bug in a different
layer of the app.

**One real tension worth flagging**: `docs/ui/implementation-plan.md`'s
Home section already says, in the existing project doc (not something I'm
introducing): _"notification bell (bell has no backend yet →
`StubNotifications`, badge dot only)"_ — i.e., the project's own prior
plan explicitly prescribed a static dot as the intended stub shape, the
opposite of what the operator's brief to E2 says. I did not edit
`implementation-plan.md` (not in my "Owns" list this track), but flagging
it here so it doesn't silently contradict E2's actual brief: whoever picks
up E2 should see this note, and `implementation-plan.md`'s Home bullet
should get corrected to "no dot" in the same change, or the next reader
will reasonably build the dot because the doc still says to.

## Decisions made (for specs.md §11)

- **Bottom nav requires a shared layout route.** Confirmed by the design's
  z-index layering (nav above both overlay screens, not per-screen) —
  `AppShell.tsx` + a pathless parent route in `router.tsx`, `Home`/
  `SearchScreen`/`HistoryScreen` as `Outlet` children. This resolves both
  open questions from the first report (nav renders on all three tabs;
  the routes do share a layout route).
- **Active-tab color mapping**: `#2FD896` → `--primary` (via `text-primary`
  - heavier `strokeWidth`, since Lucide has no filled-icon variant),
    `#5A5D64` → `--fg-disabled` (not `--muted-foreground` — confirmed by
    grepping the hex against `src/styles/index.css`, not assumed).
- **Search fades, History pushes** — read directly off each overlay's own
  keyframe name in the design source, not inferred from one being "the
  overlay screen" and the other not.
- **No back-link header on Search/History.** Superseded by the persistent
  nav; see "Spec deltas."

## Backlog / deferred (for specs.md §12)

Nothing new deferred beyond what the brief always scoped out (Add sheet
content — Track F; Profile sheet content — Track G). Both stub buttons in
`BottomNav` carry `// STUB(trackF)`/`// STUB(trackG)` markers pointing at
those.

## Doc lines to add (say exactly which file and where)

**`src/routes/README.md`** (operator-owned) — add bullets for the two new
files and update `Home.tsx`'s:

> `Home.tsx` — dashboard content placeholder for `/`, rendered inside
> `AppShell`'s `<Outlet />`. `LockSettings` moved to `Kit.tsx` (see below).
>
> `AppShell.tsx` — layout route for `/`, `/search`, `/history`: renders
> `BottomNav` once (persistent across all three tabs, per the design's
> z-index layering) plus a scrollable `<Outlet />` for the active screen.
>
> `Kit.tsx` — dev-only gallery for `src/components/shared/**`, mounted at
> `/kit` and gated on `import.meta.env.DEV` in `src/router.tsx` (not part of
> the production build's routes). See `specs.md` §10.5. Also hosts
> `LockSettings` — the only way to enable/disable the PIN lock (moved off
> `Home` when the app shell was rebuilt).

**`src/components/shared/README.md`** (operator-owned) — add, near the
other shell components:

> - `BottomNav.tsx` — the five-slot persistent tab bar (Home/History/centre
>   Add/Search/Profile), mounted once by `src/routes/AppShell.tsx`. Home/
>   History/Search are real `NavLink`s (`aria-current="page"` from
>   `NavLink` itself); active state is `text-primary` + a heavier
>   `strokeWidth` (Lucide has no filled-icon variant). Add and Profile have
>   no destination yet this wave — rendered `disabled` with `aria-label`
>   and a `// STUB(trackF|trackG)` marker, visually complete per the STUB
>   convention rather than silently inert.

**`docs/ui/implementation-plan.md`** — correct the Home bullet's
"badge dot only" phrasing per "The notification dot" above (operator's
call on exact wording; the design source has no binding gating the dot, it
is static).

## Spec deltas (anything where the brief below turned out wrong)

- **Back-link header on Search/History, from the original brief, does not
  match the actual design and was removed.** The original brief text said
  "title + back affordance" — reasonable under the assumption these are
  modal pushes on top of Home. The design proves otherwise (persistent nav
  above both overlays); a back-chevron-to-Home link would duplicate the
  Home tab and doesn't appear in the design source at all. Removed it from
  both placeholders; `common.back` (added for it) removed too since nothing
  uses it now.
- **The FAB is not a separate component** — the operator's message already
  corrected this; confirmed independently from the design source (it's the
  nav's third `<button>`, not a separate positioned element). Built as part
  of `BottomNav`, not a standalone `Fab.tsx`.

## Open questions for the operator

None outstanding. Both open questions from the first report are resolved
above (nav on all three tabs — yes; shared layout route — yes,
`AppShell.tsx`).

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/shell


 Test Files  45 passed (45)
      Tests  407 passed (407)
   Start at  02:16:57
   Duration  7.87s (transform 964ms, setup 8.67s, import 12.66s, tests 10.16s, environment 28.85s)
```

The one lint warning is pre-existing in `src/components/ui/button.tsx`
(shadcn-generated, outside this track's scope — untouched by this diff).
`bun run build` also verified clean, and used to confirm the fractional
Tailwind utilities above (`size-6.5`, `size-14.5`, `gap-0.75`,
`-translate-y-4.5`) generate real CSS rules rather than silently matching
nothing.
