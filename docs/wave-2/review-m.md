# Review — Track M (locale wiring)

## Done-when verification (ran, not read)

`docs/wave-2-plan.md` §4 Track M "Done when": switching the app to `en`/
`pt-BR` must change currency grouping/symbol placement **and** month names
on Home, Search and History together, no screen half-translated. Verified
by running the suite (baseline green before any of my own edits: 67 files,
631 tests) and then deliberately breaking three separate production sites
to confirm the new tests catch a real regression for the right reason
before trusting them:

- Hardcoded `DateChipPicker`'s chip label back to `'es-CO'`, ignoring the
  `locale` prop → `DateChipPicker.test.tsx`'s new locale test failed
  looking for `"August 10"`, found `"10 de agosto"`. Reverted, passes.
- Hardcoded `BreakdownCard`'s `locale` to `'es-CO'` → `HistoryScreen.test.tsx`'s
  new locale test failed on the `en-US`-formatted totals assertion.
  Reverted, passes.
- Hardcoded `HistoryScreen`'s `getPeriodLabel` call to the `es` date-fns
  locale → the same test failed on the month-name half instead (the regex
  `^[A-Z][a-z]+ \d{4}$` doesn't match lowercase `"agosto 2026"`, only
  capitalized `"August 2026"` — confirms the month assertion is real, not
  a no-op). Reverted, passes.

Also ran the equivalent for `WeeklyChart.test.tsx` and `SearchScreen.test.tsx`
by reading (not just executing) their new tests: both assert real DOM text
under `i18next.changeLanguage('en')` for money and day/date labels
together, same shape as the two I broke by hand. All five screens' "Done
when" tests are load-bearing, not decorative.

`bun run check` — real output, after my own fixes, on a worktree rebased
to `main`'s tip (`282b8e9`):

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  67 passed (67)
      Tests  631 passed (631)
```

(The lint warning is pre-existing, shadcn-generated `button.tsx`, untouched
by this track.)

## Findings

### 1. CONFIRMED, FIXED — the READMEs Track M handed to the operator had not been folded in yet

`docs/wave-2/track-m.md` has a "Doc lines to add (say exactly which file
and where)" section listing five specific edits across
`src/components/shared/README.md`, `src/features/home/README.md`,
`src/features/history/README.md`, `src/features/search/README.md` — None of
the four files appear in the merge commit's diff (`git diff a47edf0^1
a47edf0 --stat` — no `README.md` entries).

**Operator correction to this finding's attribution.** It first read as
Track M failing `AGENTS.md`'s "update that directory's `README.md` before
calling the task done." It is the opposite: `docs/wave-2-plan.md` §1.2
makes _the existing `README.md` of an existing folder_ operator-owned for
this whole wave, precisely because many tracks append to the same files —
a track is required to write its doc lines into `docs/wave-2/<track>.md`
and hand them over instead of editing. Track M did exactly that, correctly.
The un-applied edits were the **operator's** backlog, not the track's
omission. The generic `AGENTS.md` rule was read without the wave's own
override, which is the same class of mistake `AGENTS.md` warns about from
the other direction ("read the project's own rules before applying generic
best practice").

Left stale and actively wrong until fixed: `shared/README.md` said
`DateChipPicker` is "(date-fns, Spanish locale)" — no longer true, it takes
required `locale`/`dateFnsLocale` — and said `formatMonto`'s
`Intl.NumberFormat` instances are "memoized per `Moneda`" — also no longer
true, the cache key is `` `${locale}:${moneda}` `` (this was actually
already the real key before Track M, from the Track K review; the README
just never caught up even then).

**Fixed:** applied the five doc updates track-m.md itself specified (with
the `Moneda`→`(locale, currency)` correction folded in) to all four
READMEs.

### 2. CONFIRMED, FIXED — `DateChipPicker`'s new `Intl.DateTimeFormat` was constructed on every render, unlike the `Intl.NumberFormat` cache one file over

`movimientoView.ts` maintains a module-scope `Map` keyed
`` `${locale}:${moneda}` `` specifically because "constructing an
`Intl.NumberFormat` is expensive relative to formatting a number" (its own
comment) — for a list that "grows to years of rows." `DateChipPicker.tsx`'s
new chip-label formatter did `new Intl.DateTimeFormat(locale, {...}).format(selected)`
inline in the JSX, rebuilt on every render regardless of whether `locale`
changed. Lower severity than `MovimientoRow` (one/two instances per screen,
not one per list row), but it's the same cost class the neighbouring
module explicitly documents as worth avoiding, and the fix is a two-line
`useMemo` — no reason to leave the inconsistency once flagged.

**Fixed:** `const dayMonthFormatter = useMemo(() => new
Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }), [locale])`,
`.format(selected)` at the call site. A module-level `Map` cache (the
`movimientoView.ts` pattern) doesn't fit here — this instance is scoped to
one component's own `locale` prop, not shared across unrelated callers —
so `useMemo` is the correct idiom for a component rather than a copy of the
pure-module pattern. Verified: typecheck clean, `DateChipPicker.test.tsx`
(including the locale test) still green, full suite still 631/631.

## Shape sweep

Re-ran the sweep independently rather than trusting `track-m.md`'s claim
that it matches the brief exactly:

- `rg "date-fns/locale" src` — every remaining hit is `localeFormatting.ts`
  (the one allowed mapping module) or a `*.test.*` file passing a locale
  object as test fixture data. No production call site imports `es`/`enUS`
  directly outside that one file. Matches the report's claim.
- `rg "formatMonto|getMovimientoAmountView" src` — every call site passes a
  `locale` argument; no bare/defaulted calls remain (the parameter has no
  default to fall back to, so a miss would be a compile error, not a silent
  pass).
- `rg "Intl\.(NumberFormat|DateTimeFormat)" src` — two production
  constructors, `movimientoView.ts` (cached) and `DateChipPicker.tsx`
  (fixed to cache in finding 2, above); `Home.test.tsx`'s hardcoded
  `'es-CO'` `Intl.NumberFormat` predates this track, untouched by it, and
  is asserting the actual default-locale (`es` → `es-CO`) behavior rather
  than hiding a defect — not this track's concern.
- **Baked literal-word format patterns** (the exact blind-spot class an
  import grep can't find, which is how `"d 'de' MMMM"` survived past the
  original grep): searched every `format(..., '...', { locale })` call
  across `src/` by hand. Remaining patterns are `'yyyy-MM-dd'`, `'d'`,
  `'EEEEE'`, `'EEEE d'`, `'d MMM'`, `'MMMM yyyy'`, `'LLL'`, `'PPPP'`,
  `'yyyy'` — none embed a literal connector word. `rg "'de'|' de '|'del'|'a las'"`
  across `src/` turns up nothing outside the `DateChipPicker` fix's own
  comments/tests. **Sweep result: nothing else of this shape found.**

## A11y note (not a Track M regression, but worth naming precisely)

`DateChipPicker`'s day-cell `aria-label` (`format(day, 'PPPP', { locale:
dateFnsLocale })`) is now genuinely localized as a side effect of the
connector-word fix. The group/nav labels — `"Selector de fecha"`, `"Mes
anterior"`, `"Mes siguiente"` — are unchanged hardcoded Spanish, same as
before this track. The resulting mixed state (localized day cells, Spanish
chrome around them) is real, but it isn't new: those three strings were
already hardcoded Spanish before Track M touched the file, and the track's
brief scoped it as formatter wiring, not i18next copy retrofitting. The
`track-m.md` deferral is honest about what remains unfixed, though it
doesn't mention that the day-cell label already changed underneath it as
an incidental side effect — worth a one-line update if `track-m.md` is
touched again, but not worth blocking on since that file is a report, not
the source of truth.

## Verdict on the two judgment calls

- **Removing the `es-CO`/`es` defaults outright:** right call, well argued,
  and I traced it myself rather than taking the report's word — every
  removed default now requires a `useLocaleFormatting()` value at every
  real call site, verified by `tsc -b --noEmit` passing with zero
  `locale`-shaped errors, and by the shape sweep above finding no missed
  site. The alternative (keep the default) is exactly the trap the review-k
  finding predicted: a screenshot or a lint pass wouldn't catch a forgotten
  wire-up, because the seed data is COP-shaped regardless of locale.
- **`Kit.tsx` scope crossing:** justified. It's outside Track M's declared
  `Owns`, but the change is purely mechanical (supplying the two now-required
  props to existing `MovimientoRow`/`DateChipPicker` call sites) and is a
  direct, compiler-forced consequence of the default-removal decision made
  inside scope — not an independent design choice made in someone else's
  file. No behavior or ownership boundary was crossed, only a compile error
  fixed at its unavoidable second site.

## What I left alone

- `MovimientoRow`'s "Estimado" pending-badge text and the general state of
  UI-copy-not-yet-in-`i18next` across the codebase — pre-existing, explicitly
  out of this track's scope (formatter wiring, not copy translation), same
  class as the deferred `DateChipPicker` aria-labels.
- Everything else in the diff — `homeView.ts`, `historyPeriodLabel.ts`,
  `historyPeriodOptions.ts`, `useHomeDashboard.ts`, `BalanceCard.tsx`,
  `WeeklyChart.tsx`, `RecentMovimientos.tsx`, `BreakdownCard.tsx` (beyond
  finding 1's doc line), `HistoryScreen.tsx`, `SearchScreen.tsx`,
  `FilterSheet.tsx`, and every touched test file — read in full, diffed
  against the "must not touch" list (`localeFormatting.ts` correctly
  untouched), and matched their brief with nothing to flag.

## Process note

Same defect class `AGENTS.md`'s "fix the shape, not the instance" section
names, but at the process level rather than the code level: a report that
lists exactly what documentation should change is not evidence the change
happened. Worth treating "doc lines to add" sections in any track report as
a checklist to verify against the actual diff, not just read — this is the
second time in this project's history (per `AGENTS.md`'s own callout) that
trusting a green suite plus a well-argued report stood in for checking the
diff itself.

## `bun run check` — final, after fixes

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  67 passed (67)
      Tests  631 passed (631)
```
