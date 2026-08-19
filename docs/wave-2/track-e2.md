# Track E2 — Home dashboard content — report

## What was built

`src/features/home/` (new): `useHomeDashboard.ts` (the data hook — wraps
`dataStore` + `movimientoStats`, no local aggregation), `homeView.ts` (pure
presentation helpers: greeting bucket, initials, day labels, week-strip
scaffold), `errorCopy.ts` (`RepoErrorCode` → translation key, exhaustive —
see "Spec deltas"), `usePrefersReducedMotion.ts`, and the components
`HomeHeader`, `WeekStrip`, `BalanceCard`, `WeeklyChart`, `AreasBanner`,
`RecentMovimientos`, `HomeLoadingState`, `HomeEmptyState`, `HomeErrorState`.
`src/routes/Home.tsx` rewritten to compose them behind
`useHomeDashboard`'s status. Every file has a colocated test except the
purely presentational leaf components (`HomeHeader`, `WeekStrip`,
`WeeklyChart`, `AreasBanner`, `RecentMovimientos`, the three state panels),
which are exercised through `Home.test.tsx`'s integration coverage of all
four states instead of duplicating that coverage per-file.

Every figure on screen traces to `movimientoStats`: the balance card is
`totals(movimientos)` (all movements, no range filter — see "Spec deltas"
on why it's not week-scoped), the weekly chart is
`series(movimientos, 'semana', periodRange('semana', today, primerDiaSemana), primerDiaSemana)`
called once and rendered as-is (no re-bucketing), and the weekly total is
`totals(filterByRange(movimientos, weekRange)).gastos` — not a sum of the
chart's own per-day floats, to avoid reintroducing the exact drift
`movimientoStats` exists to prevent. `useHomeDashboard.test.ts` and
`Home.test.tsx` both assert the rendered total equals `totals()` called
directly on the same `movimientos` array (the brief's required
cross-screen-consistency test).

Money formatting reuses `movimientoView.ts`'s existing `formatMonto` — not
a new formatter (see "Spec deltas" on why this diverges from the brief's
"active locale" wording).

## Decisions made (for specs.md §11)

- **"Balance total" is all-time, not period-scoped.** Read directly from
  the design source (`renderVals()`, ~line 2168): `income`/`expense`/
  `balance` sum **all** of `this.state.transactions` unconditionally, with
  no date filter — the week strip's `weekOffset` never touches it. Home
  therefore calls `totals(movimientos)` with no range argument. Flagged as
  an open question below because Track E4's brief expects a "Home's month
  total" to cross-check against — no such figure exists on Home as
  designed.
- **No week-navigation (prev/next) or day-tap-to-History on the calendar
  strip.** The design wires both (`prevWeek`/`nextWeek`, `d.onTap` →
  `openDetail(...)` into History's day view). Home's brief only asks for
  a display strip with a hide/show toggle on the balance, not navigation.
  Wiring day-tap into History would make Home assume a shape of History's
  routing/state contract that Track E4 (same stage, parallel worktree)
  owns and hadn't built yet at branch time — a real cross-track risk, not
  just extra scope. Built the strip read-only: current week only, "today"
  highlighted, a dot on days with at least one real movement (derived from
  `movimientos`, not hardcoded). "Ver todo" on the Movimientos section
  header does link to `/history` — a plain route navigation with no
  params, so it can't drift from whatever E4 builds.
- **"Áreas" banner renders `disabled`, not merely non-`onClick`.** The
  brief's literal text was "renders, does not navigate," but the design's
  markup is a full-color, drop-shadow-free interactive-looking row
  (`onClick` div, colored icon, chevron) — the same shape as any other
  interactive banner in this design. A full-color row with silently no
  effect on tap reads as broken, not as a preview. `BottomNav`'s own
  Add/Profile stubs (Track L, merged) already established the answer for
  exactly this situation in this codebase: render `disabled`, dim the
  content to `text-fg-disabled`, keep the `// STUB(trackH)` marker. Applied
  the same pattern here for consistency rather than inventing a third
  stub treatment.
- **No new design tokens** — three places needed a color/surface the
  design used that has no existing token, and each was mapped onto an
  existing one instead of adding a new hex/token (`AGENTS.md` §1.3):
  - Balance panel's dark-green tint (`#1A4437`) → `bg-success/10` /
    `border-success/20`.
  - Its nested income/expense mini-cards (`#14372C`) → `bg-surface-sunken`
    (the token that already exists for exactly this "recessed surface"
    role).
  - Weekly chart's three bar states (today/zero/other,
    `#2FD896`/`#23262E`/`#3A3F49`) → `var(--primary)` /
    `var(--color-border-subtle)` / `var(--color-fg-disabled)`.
- **Expense mini-card icon is danger-tinted; the expense amount text is
  not.** The design's home-screen expense badge icon is reddish, which at
  first read looks like it contradicts `movimientoView.ts`'s documented
  rule ("expense is never flagged red, only income gets a color
  call-out"). Read closely, that rule is about the amount **text** on an
  individual `MovimientoRow`, not an aggregate stat badge's icon color.
  Followed the design pixel-for-pixel here: icon circle uses the
  `danger` tint, the peso figure next to it stays `text-foreground` (no
  color), keeping `movimientoView.ts`'s rule intact for what it actually
  governs.
- **Hide/show toggle is local component state, not persisted.** The design
  persists it to `localStorage` (banned for this app — `AGENTS.md` §
  Security guardrails) and the brief doesn't ask for persistence. Resets
  to visible on remount; not a data-integrity concern since it's a display
  toggle, not a value.
- **Recharts renders bars only; day labels are plain Tailwind text below
  the chart, not an `XAxis`.** Keeps typography on the same token scale as
  the rest of the app instead of hand-tuning SVG `fontSize` px values to
  approximate a token. `isAnimationActive` is gated on
  `usePrefersReducedMotion` (new hook, first JS-level reduced-motion check
  in this codebase — the global CSS override in `index.css` only covers
  CSS transitions/animations, not recharts' own JS-driven one). The hook
  degrades to `false` when `window.matchMedia` is unavailable (jsdom has
  none) rather than throwing — kept self-contained in `src/features/home/`
  instead of touching the shared `src/test/setup.ts`, so there's no
  cross-track file-conflict risk with the parallel E3/E4 worktrees.

## Backlog / deferred (for specs.md §12)

- No week navigation / day-drill-down on Home's calendar strip (see
  decision above) — a natural Wave-3-or-later enhancement once History's
  real routing/query contract (Track E4) is settled and stable to build
  against.
- Currency/date formatting is fixed to `es-CO`/`es` regardless of the
  active i18n locale (see "Spec deltas" below) — a real gap if/when the
  app ships a non-Spanish locale for real, not introduced by this track
  but not fixed by it either.

## Doc lines to add (say exactly which file and where)

**`src/routes/README.md`** (operator-owned) — `Home.tsx`'s bullet should
read: "the dashboard for `/`, rendered inside `AppShell`'s `<Outlet />` —
greeting/search chrome plus loading/error/empty/ready states from
`useHomeDashboard` (`src/features/home/`)."

## Spec deltas (anything where the brief below turned out wrong)

- **"Real numbers from `movimientoStats`... Intl.NumberFormat with the
  active locale" vs. the existing shared formatter.** The brief says to
  format money with "the active locale." `src/components/shared/
movimientoView.ts`'s existing `formatMonto` — which `AGENTS.md` and this
  brief both say to check and reuse before writing a new one — hardcodes
  `Intl.NumberFormat('es-CO', ...)` regardless of the active i18n locale
  (and `MovimientoRow.tsx` does the same for its date label, via a fixed
  `date-fns/locale` `es` import). Reused the existing formatter as-is:
  the alternative was building a second, locale-reactive money formatter
  for Home alone, which is exactly the two-formatters-disagreeing problem
  `AGENTS.md`'s "search before you write" rule exists to prevent — Home
  and every `MovimientoRow` it renders would show the same peso amount
  differently formatted depending on which code path formatted it. This
  codebase doesn't have true active-locale-aware `Intl`/`date-fns`
  formatting anywhere yet; that's a pre-existing gap, not something this
  track introduced or is positioned to fix unilaterally across three
  files it doesn't own.
- **`AppShell.test.tsx` (Track L, merged) asserts `<Home />` renders a
  heading named `APP_NAME`.** The design's Home screen has no literal
  app-name title anywhere in it. Rather than edit another track's
  (merged) test file, kept the contract: `Home.tsx` renders a
  screen-reader-only `<h1>{APP_NAME}</h1>` — a legitimate a11y landmark
  (every route needs exactly one accessible heading) that happens to also
  keep that pre-existing assertion green. Not a hack around the test; the
  heading is real, just visually hidden because the design has no visual
  title element for this specific screen.
- **Bottom-nav clearance is already handled by `AppShell`, not by
  `Home.tsx`.** The brief said Home's content should pad by
  `pb-(--bottom-nav-clearance)`. `AppShell`'s scrollable outlet pane
  (`flex-1 overflow-y-auto pb-30`, per Track L's own report) already
  reserves clearance for every screen inside it. Adding a second bottom
  padding in `Home.tsx` would double the gap under the nav. Left it out.

## Open questions for the operator

- **Track E4's brief says "a test asserts History's month total equals
  Home's for the same month."** Home, both by design and by this track's
  own brief, has no month-scoped total — "Balance total" is all-time
  (see decision above), and the only period-scoped figure on Home is the
  weekly gastos total. There is nothing on Home shaped like "this month's
  total" for E4 to compare against. Either E4's cross-check needs to
  target something else (e.g. compare against `totals(filterByRange(...))`
  computed directly, the way this track's own test does, rather than a
  literal on-screen Home figure), or Home needs a month total this track
  wasn't briefed to build. Did not add one unilaterally — flagging for a
  decision before E4 lands.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/home


 Test Files  52 passed (52)
      Tests  501 passed (501)
   Start at  02:43:10
   Duration  8.16s (transform 1.25s, setup 9.03s, import 18.34s, tests 9.23s, environment 26.18s)
```

The one lint warning is pre-existing in `src/components/ui/button.tsx`
(shadcn-generated, outside this track's scope). `bun run build` also
verified clean; grepped the built CSS for every fractional/multi-digit
Tailwind utility introduced here (`size-10.5`, `h-31`, `h-50`, `mt-0.25`,
etc.) to confirm each resolves to a real `calc(var(--spacing) * N)` rule
rather than silently matching nothing, following Track L's own
verification practice.
