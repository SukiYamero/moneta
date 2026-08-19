# Track E4 — report

## Decisions made (for specs.md §11)

- **The scope selector is all four `Periodo` values (`dia`/`semana`/`mes`/`anio`), not the three the design's mock code actually wires up.**
  The design's `scopes` array only builds Día/Semana/Mes — the `anio` value
  the design's own year dropdown implies ("aplica a cualquier scope") is
  never actually a selectable scope in the mock, and
  `hint-placeholder-count="4"` on that `<sc-for>` (vs. 3 real entries)
  suggests it was dropped from an earlier revision. Built it as a real 4th
  scope anyway: `Periodo` already defines `'anio'`,
  `movimientoStats.periodRange`/`breakdownBy`/`filterByRange` already handle
  it correctly, and shipping a UI that maps 1:1 onto the domain type is more
  honest than silently leaving a defined enum member unreachable. When
  `anio` is selected there is no day/week/month picker strip (nothing to
  sub-select), only the year menu.
- **Added previous/next chevrons flanking the period title**, which the
  design doesn't draw. The design's day/week/month picker strips are scoped
  to the currently viewed month/year (`vm`/`vy` in the mock) with no way to
  reach an adjacent month from `dia`/`semana` scope except switching to
  `mes` scope, picking a month, then switching back. The brief's "Done
  when" also explicitly asks for period navigation (previous/next) with
  non-drifting month/year-end stepping. The chevrons close that real gap
  and directly exercise `useHistoryPeriod.step()`, which is the piece with
  actual boundary-correctness risk.
- **No hide/show-amounts toggle** (the design draws one, `eyeIconDetail`/
  `toggleHide`). Masking figures would need `MovimientoRow` to accept an
  override for its computed amount text, which it doesn't — adding that
  prop is a change to a shared, already-merged component outside
  `src/features/history/**`, this track's ownership boundary. Left out
  rather than working around it locally (e.g. re-deriving row markup
  instead of using `MovimientoRow`), which would have duplicated shared
  rendering logic.
- **Year menu uses `useEscapeToClose` plus an outside-pointerdown
  listener** (mirroring `DateChipPicker`'s popover), not `useOverlay`. It's
  an anchored menu, not a modal — no focus trap, no scroll lock, no portal
  needed. The brief flagged this exact question; this is the answer.
- **Picker chip "has data" flags and bounds are never hand-rolled**: every
  day/week/month/year option in `historyPeriodOptions.ts` gets its exact
  range from `periodRange()` and its data flag from `filterByRange()`,
  including week chips (which must honour `primerDiaSemana`). This was the
  one place in this track most tempted to reimplement calendar math
  locally (e.g. bucketing weeks by hand) — didn't.

## Backlog / deferred (for specs.md §12)

- Hide/show-amounts toggle for History (see above) — needs a
  `MovimientoRow` prop addition first, owned by whichever track next
  touches that component.
- Nothing else. Every "Done when" bullet in the brief is implemented and
  tested.

## Doc lines to add (say exactly which file and where)

`src/routes/README.md`, if/when it documents per-route ownership beyond the
one line it already has pointing at `HistoryScreen.tsx` — no change needed
there today, it already says the right thing.

## Spec deltas (anything where the brief below turned out wrong)

- Brief said "Year menu, scope `SegmentedControl` (day/week/month/year)" —
  correct as written, but the design it points to only mocks 3 of the 4
  scopes (see decision above). Brief's intent held; the design was
  incomplete, not the brief.

## Open questions for the operator

- Confirm the 4th (`anio`) scope is wanted in the actual product, not just
  defensible from the type. If not, it's a one-line revert (`SCOPES`/
  `PICKER_FOR_SCOPE` in `historyPeriodOptions.ts` + `HistoryScreen.tsx`)
  and 4 fewer locale keys.
- Whoever owns `MovimientoRow.tsx` next: History's hide/show-amounts gap
  needs a way to override/mask the rendered amount text.

## CONFIRMED bug found outside this track's ownership

`repo.fake.ts`'s seed dates land one calendar day earlier than intended
under negative-UTC-offset TZs — traced exactly, not guessed.

`FAKE_REPO_SEED_DATE = new Date('2026-08-18T00:00:00.000Z')` is a
UTC-midnight instant. `seedMovimientos()` computes each row's `fecha` as
`format(subDays(FAKE_REPO_SEED_DATE, offsetDays), 'yyyy-MM-dd')` —
date-fns's `format()` reads the local calendar day off that instant. Under
any negative UTC offset (this sandbox: America/Bogota, UTC-5 — one of the
exact timezones AGENTS.md/specs.md call out as "every user this app
targets"), a UTC-midnight instant's local calendar day is the day before:

```
$ node -e "console.log(new Date('2026-08-18T00:00:00.000Z').toString())"
Mon Aug 17 2026 19:00:00 GMT-0500 (Colombia Standard Time)
```

So the row templated as `offsetDays: 0` ("today", nota "Café de la
mañana") actually seeds with `fecha: '2026-08-17'`, not `'2026-08-18'` —
every seeded row is one calendar day earlier than its `offsetDays` comment
implies, for every developer/CI machine running west of UTC. This doesn't
break cross-screen agreement (Home/Search/History all read the same
shifted data, so they still agree with each other), but it does mean
"today" (a screen's own `new Date()`) never lines up with the seed's
intended "day 0" row under these timezones — the same bug class AGENTS.md
item 5 warns about (parsing an ISO date string as UTC), mirrored: here a
UTC instant is formatted as if its calendar day were timezone-agnostic.

Out of scope to fix myself: `repo.fake.ts` isn't in `docs/wave-2-plan.md`
§1.3's frozen list, but it's a shared fixture Track E1 built and Home/
Search also read — not something this track owns. Worked around it in
`HistoryScreen.test.tsx` by reading the seed's real `fecha` from the repo
instead of assuming a literal date string, so this suite is correct
regardless of the runner's TZ; did not touch `repo.fake.ts` itself. Likely
fix: seed with a local-midnight anchor (e.g. `new Date(2026, 7, 18)`)
instead of an explicit-UTC ISO string. Operator's call given it's shared,
merged, cross-track code.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/history

 Test Files  53 passed (53)
      Tests  498 passed (498)
   Start at  02:44:20
   Duration  9.29s
```

The one lint warning is pre-existing in `src/components/ui/button.tsx`
(shadcn-generated, outside this track's scope — untouched by this diff).

## Cross-screen guarantee — corrected mid-task by the operator

The brief's original "Done when" asked for a test asserting "History's
month total equals Home's for the same month." That guarantee cannot hold:
Track E2 landed with Home's balance card all-time (the design's own
`renderVals()` computes it unconditionally), and its only period figure is
a weekly expense total — there is no month number on Home to compare
against. The operator caught this and corrected the brief before I built
against it (message received mid-task, addressed on this branch before
finishing).

The guarantee actually meant, and what's implemented:
`HistoryScreen.test.tsx` has an `it.each` over all four `Periodo` values
that computes the expected totals independently in the test —
`totals(filterByRange(movimientos, periodRange(periodo, anchor,
primerDiaSemana)))`, the same call any other screen would make — and
asserts the rendered balance/income/expense figures match, for each scope
after clicking it. It would fail if `HistoryScreen` ever computed a total
through any path other than `movimientoStats`. Not a diff against Home;
Home has nothing period-scoped to diff against yet. Combined with Home's
own tests asserting the same property on its side, and E1's bucket-range
invariant proving the module internally consistent, this is the real
cross-screen guarantee: every screen traces to one shared aggregation
module, not a comparison between two screens that legitimately show
different things.

## Other operator corrections addressed mid-task

- **`AppShell.test.tsx`'s `/historial/i` heading assertion for `/history`**
  (written against Track L's placeholder) — no change needed.
  `HistoryScreen`'s real body keeps an `sr-only` `<h1>{t('title')}</h1>`
  ("Historial") for exactly this reason (screen-reader/landmark identity
  independent of the visible period-scoped header), so the existing
  assertion already passes against the real screen — confirmed via
  `bun run check`, not just reasoned about.
- **Currency/date formatting** — already compliant. `BreakdownCard.tsx`
  imports `formatMonto` from `movimientoView.ts` (never a second
  formatter), and `historyPeriodLabel.ts`/`historyPeriodOptions.ts` use
  `date-fns/locale`'s `es`, matching `MovimientoRow.tsx`'s own convention —
  no locale-aware formatting was invented for this screen.
