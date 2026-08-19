# Review — Track E2 (Home dashboard)

## "Done when" — verified by running, not reading

- `bun run test` (617 tests, 67 files) — every number on Home traces to
  `movimientoStats`: `Home.test.tsx` asserts the balance card's rendered
  total equals `totals(movimientos)` computed directly on the same array
  (the brief's required cross-screen-consistency test), and separately
  asserts the recent list and the Áreas stub render from real/no data.
- Loading (`role="status"`, `aria-busy`), empty (`HomeEmptyState`), and
  error (`role="alert"` + working retry) all render and are exercised by
  `Home.test.tsx`'s four state tests, including a full error→retry→ready
  transition via `userEvent`.
- `bun run check` real output, pasted at the bottom — green.

The "Done when" list is met. No gap found here.

## Findings

### 1. CONFIRMED — the interrupted WIP's touch-target fix resized the visible pill, not just its tap target

`BalanceCard.tsx`'s eye toggle (`size-8.5`, 34px) and `HomeHeader.tsx`'s
bell (`size-10.5`, 42px) are both below AGENTS.md's 44px touch-target
floor — a real, reproducible gap: the WIP commit (`f4c357f`) grew both to
`min-h-11 min-w-11`, but kept every visual class (`rounded-lg
bg-success/15 text-success` / `rounded-xl border border-border bg-card
text-fg-secondary`) on the same element. Since neither element has fixed
`width`/`height` competing with the `min-*` classes, the browser box
becomes 44×44 — the pill itself grows past its designed size, a real
visual regression, not merely a "colors dropped" issue as first
characterized when this WIP was handed off. Confirmed by diffing `main`
against the WIP commit directly: every background/radius/color class is
present in both old and new `className` strings; only the sizing utility
changed.

**Fix:** split hit area from visual, following the pattern this codebase
already uses for exactly this situation (`DateChipPicker.tsx`'s
month-prev/next buttons: `min-h-11 min-w-11` outer button, the visible
`size-7 rounded-sm bg-muted` circle on an inner `<span>`). Applied the
same shape to both: outer `<button>` carries only layout + `min-h-11
min-w-11`; the pill's full original class list moved to an inner `<span>`
at its original size (`size-8.5` / `size-10.5`). Outer button classes
(`min-h-11`, `min-w-11`) still satisfy the existing WIP tests unchanged.
Added one test per component asserting the _split_ itself — the button no
longer carries the pill's background class, and the inner span carries
both the original size and the background — so a future regression back
to painting the outer element fails a test, not just a lint of eyeballs.
Watched both new tests fail against the WIP's un-split version (`git show
f4c357f:...`) for the right reason (`toHaveClass('bg-success/15')` /
`'bg-card'` failing on the button) before restoring the fix and watching
them pass.

**Shape sweep of `src/features/home/**`:** every other interactive
element checked — `AreasBanner`'s stub button (full-width row, height
driven by two lines of text + `py-3.75`, comfortably over 44px),
`HomeErrorState`'s retry button (`h-11`exact,`px-6`padding gives ample
width),`Home.tsx`'s search-entry `Link` (`h-11.5`, full width) — none of
them paint a fixed-size visual pill directly on the interactive element,
so none share this shape. Nothing else to fix.

### 2. Genuine (kept as-is) — `RecentMovimientos`'s "Ver todo" touch-target fix

`min-h-11 items-center` added to the `Link` is a real 44px-floor fix with
**no** visual side effect: the design draws bare text with no background
box, so growing only the vertical hit area doesn't resize anything visible
— unlike finding 1, there's no pill to distort. Kept as the WIP wrote it.

### 3. Genuine (kept as-is) — `WeeklyChart.test.tsx`

New test file only, no production change (`WeeklyChart.tsx` already
matched). Verified each assertion against the real component: `barStatus`
correctly prioritizes "today" over "zero" (index 2 in the fixture), the
zero/value/today fill tokens resolve correctly, and `isAnimationActive`
is genuinely wired to `usePrefersReducedMotion` via `matchMedia`
stubbing. All five cases pass and test real behavior, not the mock's own
plumbing. Kept as written.

## Things checked and found fine (no change)

- **Money/date correctness.** `homeView.ts` parses ISO dates with
  `parseISO` (local time) throughout, never `new Date(isoDate)` — matches
  specs.md §11's UTC-midnight footgun already documented for this
  codebase. `useHomeDashboard.ts` calls `movimientoStats` exactly per the
  brief (`series(movimientos, 'semana', periodRange(...), primerDiaSemana)`
  called once, not re-bucketed; the weekly gastos total is its own
  `totals(filterByRange(...))` call, not a sum of the chart's own bars —
  the same anti-drift instinct `movimientoStats.ts`'s own docs call out).
- **Error handling.** `HomeErrorState` uses `role="alert"` with a working
  retry (matches `docs/error-handling.md` §7 — Home was never the screen
  that drifted to `role="status"`; that was E4, already fixed in its own
  review). `errorCopy.ts` is an exhaustive `Record<RepoErrorCode, ...>`
  with no message-string drift risk, correctly using the "no test needed,
  a missing case is a compile error" shape documented in
  `docs/error-handling.md` §7.
- **State/derivation.** No cached duplicate of a derived value anywhere in
  `useHomeDashboard.ts` — `dataStore` holds raw entities only, every
  number recomputed via `movimientoStats` on each render's `useMemo`.
- **A11y.** `aria-pressed` on the hide/show toggle, `aria-label`s
  present and translated, loading state's `sr-only` text is `role="status"`
  (correct — non-error informational state), error is `role="alert"`.

## Not fixed — flagged for the operator

- **`homeView.ts` hardcodes `date-fns/locale`'s `es` in three places**
  (`shortDayLabel`, `narrowDayLabel`, `monthYearLabel`), with no parameter
  to override it — unlike `MovimientoRow.tsx`, which at least accepts an
  optional `dateFnsLocale` prop defaulting to `es`. This is explicitly the
  kind of "Home-specific consequence beyond" the already-flagged
  `movimientoView.ts`/`MovimientoRow.tsx` locale gap the operator asked me
  to watch for: it's not this track reusing the shared formatter, it's
  this track's own presentation helpers independently baking in the same
  hardcoded locale, in a file `src/features/home/**` owns.

  While this review was in progress, `main` picked up
  `src/lib/i18n/localeFormatting.ts` (`feat(i18n): map the active locale to
Intl and date-fns formatting`, `7c09250`) — exactly the mechanism this
  needs: `useLocaleFormatting()` returns both the `Intl` tag and the
  matching `date-fns` `Locale`. It has **zero consumers yet**: neither
  `movimientoView.ts`/`MovimientoRow.tsx` nor `homeView.ts` calls it. Not
  wiring it in here — `BalanceCard.tsx`/`WeeklyChart.tsx` format money via
  `formatMonto` (still `es-CO`-only), so localizing only `homeView.ts`'s
  dates would leave Home showing a translated date next to a Colombian-
  formatted peso figure, a worse inconsistency than the current
  all-Spanish baseline. This needs one pass across
  `movimientoView.ts`/`MovimientoRow.tsx`/`homeView.ts` together, not a
  partial fix here — flagging so the upcoming pass threads
  `useLocaleFormatting()` through Home's three call sites too, not just
  the shared component.

## Process note

The interrupted WIP's own inline comments (`"AGENTS.md's touch-target
floor"`) were accurate about _what_ was wrong but silent about the _visual_
side effect of the fix chosen — a comment justifying a touch-target change
should say what it does to the element's appearance, not just cite the
rule being satisfied. That's what made the regression invisible to a
reviewer skimming the diff rather than rendering it: the class list read
as "grew, plus everything it had before," which looks like a strict
superset, not a resize. The Search screen's `DateChipPicker` pattern
existed in the same codebase at the time; the fix that produced this WIP
didn't check for one before inventing its own.

Separately: `main` advanced by six commits (two more track merges plus the
locale-formatting feature) between when this worktree was set up and when
this review reached its squash step, well past what "already rebased on
current main" described at hand-off. A first `git reset --soft main`
against the stale working tree produced a diff that looked like it was
reverting `docs/wave-2-plan.md`/`docs/waves.md` and deleting
`src/lib/i18n/localeFormatting.*` — none of which this track touched or
should touch. Caught before committing by checking `git status --short`
against what was actually edited, not by any tooling. A reviewer whose
worktree sits open for a while should re-diff against `main`'s current tip
immediately before the final squash, not trust the state described at
task start.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/rv-home


 Test Files  67 passed (67)
      Tests  617 passed (617)
   Start at  08:31:44
   Duration  12.78s (transform 1.40s, setup 12.77s, import 37.92s, tests 13.68s, environment 38.63s)
```

Run against current `main` (`7c09250`, which now includes the locale-
formatting feature — see "Not fixed" above), after re-applying this
track's actual file changes on top rather than the stale tree the WIP
commit was built from. The one lint warning is pre-existing in
`src/components/ui/button.tsx` (shadcn-generated, outside this track's
scope) — same warning Track E2's own report already noted. 617 = `main`'s
baseline 606 (63 files) plus the WIP's four new test files (11 tests:
kept, sound once the production code they exercised was fixed) — the two
new pill-size regression tests added here are among those 11, inside
`BalanceCard.test.tsx`/`HomeHeader.test.tsx`.
