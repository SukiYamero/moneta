# Review — Track E1 (aggregation + screens' data layer)

Reviewer pass on `movimientoStats.ts`/`.test.ts`, `dataStore.ts`/`.test.ts`,
`repoProvider.ts`/`.test.ts` as merged (`799f3e1`, `7ccc4be`). Branch
`review/rv-stats`.

## Findings, most severe first

### 1. CONFIRMED (low severity) — the bucket-range invariant's own doc comment and test overclaimed bit-exactness; test coverage had two real gaps

Reproduced in-repo. `series()`'s doc comment claimed
`sum(series(...).ingresos) === totals(filterByRange(movimientos, range)).ingresos`
"always holds," and the existing invariant test asserted this with `toBe`
(strict `Object.is` equality). That claim is false for a real, reachable
input: two movements of the **same `tipo`** landing in **different buckets**
of one period, with fractional-cent `monto`s. Concretely — `semana` period,
`primerDiaSemana=1`, movement A `fecha: '2026-08-17', tipo: 'ingreso', monto: 0.01`,
movement B `fecha: '2026-08-18', tipo: 'ingreso', monto: 0.05`:

```
seriesIngresos 0.060000000000000005
expected       0.06
```

Cause: each bucket independently calls `totals()`, which divides its own
integer-cent sum once (correct, per bucket). But `0.01 + 0.05` (two already-
divided floats) is not bit-identical to `(1 + 5) / 100` in IEEE754 — this is
inherent float-addition non-associativity, not a reintroduction of the
naive-`+=`-on-`monto` bug the money rule exists to prevent (that bug is
still correctly fixed; `totals()` itself never sums raw `monto` floats). The
existing invariant test never caught this because its four fixed movements
give at most **one** nonzero value per `tipo` per case — there's nothing to
add, so there's nothing to drift.

**Why this is low severity, not a real user-facing bug:** it only manifests
for `monto` values with genuine sub-2-decimal-peso structure spread across
multiple buckets and the same `tipo` — COP has no subunit in real use, and
the drift (~1e-15) is erased by any 2-decimal display formatting
(`Intl.NumberFormat`, which every screen must use per the wave-2 plan). I
could not construct a scenario where this changes what a user sees.

**Two coverage gaps found alongside it**, both closed:

- The invariant `it.each` only ever ran with `primerDiaSemana=1`. The clamp
  bug it guards against is rooted in `eachWeekOfInterval`'s grid, which is
  keyed off `weekStartsOn` — a fix proven only for one `primerDiaSemana`
  value says nothing about the other, and `AGENTS.md`/the brief's own "week
  rule" explicitly requires both directions tested. I probed `primerDiaSemana=0`
  for all four periods first (standalone script, not committed) — it passed
  in every case, so this was a coverage gap, not a live bug — then folded it
  into the permanent suite as a cross-product (`periods × [0, 1]`), 8 cases
  instead of 4.
- No case exercised multiple same-`tipo` nonzero buckets at all. Added one,
  asserting `toBeCloseTo(expected, 2)` — the actually-meaningful financial
  guarantee (agreement to the cent) rather than the unachievable bit-exact
  one. A real clamp regression (the original bug this invariant was built
  to catch) is off by whole pesos, far outside a 2-decimal tolerance, so
  this stays exactly as effective a regression guard as the `toBe` version
  for the case that matters, while no longer being fragile to legitimate
  float noise.

**Fix applied** (`src/lib/movimientoStats.ts`, `src/lib/movimientoStats.test.ts`):
softened the doc comment on `series()` to state the real guarantee ("to the
cent," not bit-for-bit, with the mechanism named); extended the invariant
`it.each` to the `primerDiaSemana` cross product; added the same-`tipo`
multi-bucket test using `toBeCloseTo`. Watched the strict version fail first
(standalone script, shown above — `0.060000000000000005` vs `0.06`), then
committed the corrected, still-meaningful version. All 30 tests in the file
now pass, `bun run check` green.

**Sweep for the same shape:** `breakdownBy()`'s `share` is a single division
(`totalMinor / grandTotalMinor`) of two already-summed integers — no
multi-float addition, no drift; verified (`share`s summed to exactly `1`
across three fractional entries). `totals()` itself sums only in integer
minor units and divides once — the one addition that must never drift, and
doesn't. **Nothing else in these three files has this shape.** It only
exists in `series()`, and only because a bucket is itself a `totals()` call
whose output a caller can then re-sum. Flagging for the operator, not fixing
(out of my scope, `src/features/**`): if Home's or History's chart ever sums
`series()` bucket values in a component to cross-check against a totals
card, the same float-noise property applies there too — invisible after
`Intl.NumberFormat`, but worth knowing it's not bit-exact if a future test
in those tracks ever asserts raw equality between the two.

### 2. Style/rule fix — `bucketStartsFor`/`bucketEndFor` used an if-chain where the codebase's own convention is a `Record`

`AGENTS.md`: "Pure value → value mappings use a lookup table / `Record`,
never `switch` or `if/else` chains." `bucketStartsFor`/`bucketEndFor`
dispatched on `BucketGranularity` via `if (x === 'month') … if (x === 'week') …
return …` — while two functions above, `RANGE_FOR_PERIODO` already
establishes the pattern for exactly this shape (branches with different
signatures/behavior per key, stored as a `Record` of functions). Refactored
both to `Record<BucketGranularity, (…) => …>` (`BUCKET_STARTS_FOR`,
`BUCKET_END_FOR`), matching `RANGE_FOR_PERIODO`'s existing precedent. Pure
refactor, no behavior change — confirmed by the full suite staying green
(`581/581`) with identical assertions before and after.

### 3. Attacked and could not break: money math, TZ/date handling, DST, year boundary, leap day, large amounts

Wrote (and discarded after confirming, since they added no coverage the
permanent suite lacked) standalone probes for:

- **Very large COP amounts**: `999_999_999_999 + 1` summed to exactly
  `1_000_000_000_000` — well inside `Number.MAX_SAFE_INTEGER` even in cents.
  Not a real risk at any COP scale this app will see.
- **`monto` with 3+ decimal places**: `100.005` rounds to `100.01` via
  `Math.round(monto * 100)` — deterministic, no `NaN`, no crash. Matches the
  documented rule (round to the nearest cent on the way in).
- **Integer-peso `monto`s**: sums stay exact integers throughout (cents are
  always exact multiples of 100 for whole-peso input, so `fromMinorUnits`
  never introduces float noise in the realistic COP case) —
  `{ ingresos: 50_000, gastos: 12_345, balance: 37_655 }`, exact.
  `breakdownBy` share sums: exact `1` across fractional-share entries.
- **DST transition** (`America/New_York`, which — unlike Colombia — observes
  it): `periodRange('mes', …)` across the March 2026 spring-forward and
  `series('semana', …)` across the November 2026 fall-back both produced
  correct, unaffected bucket boundaries and labels. Expected, since every
  date operation here is calendar/day-level via `date-fns`, never a
  wall-clock-hour computation — DST shifts an hour, never a calendar day.
- **Year boundary**: `periodRange('mes', '2026-12-15', 1)` correctly bounds
  to `2026-12-31` (no bleed into January); a `semana` range spanning
  Dec 28–Jan 3 produces 7 correctly-dated buckets and the invariant holds.
- **Leap day**: `2028-02-29` (2028 is a leap year) lands in the February
  bucket of a 12-bucket `anio` series with the right amount; no special
  handling needed since `date-fns`'s calendar functions already know Feb has
  29 days that year.
- **`primerDiaSemana` both ways**: already covered above (item 1's gap-fill);
  `periodRange`'s own dedicated tests already covered both directions.

None of these produced a defect. Reporting the "attacked and it held"
result plainly, per `AGENTS.md`'s "never pad" instruction — money/date math
here is solid.

### 4. `dataStore` race-safety: checked for real, holds

Traced (not just read) the synchronous check-then-`set` guard in `load()`:
the `status === 'loading' || status === 'ready'` check and the `set({
status: 'loading' })` that follows it are both synchronous, before the first
`await` — identical shape to `authStore.restore()`'s guard, which this
track's own decisions log cites as precedent and which I confirmed by
reading `authStore.ts` directly. Two `load()` calls issued back-to-back
(`Promise.all([load(), load()])`, already in the test suite) can't both pass
the guard: the first call's synchronous prefix runs to completion (setting
`status: 'loading'`) before the second call's guard check ever runs, because
nothing yields to the event loop between them. Verified this reasoning
against the actual passing test rather than trusting the comment alone.
Failure-then-retry (`status: 'error'` → a second `load()` call) is also
correctly unguarded — `'error'` isn't in the blocking set — and the existing
test proves the retry both re-fires the repo call and lands `'ready'`.
Nothing to fix here.

One informational, not-a-finding note: `series()` given an already-invalid
`range` (`from > to`) doesn't throw — it silently returns buckets, all
labelled with the same date, all zero. This would technically be a
`docs/error-handling.md` §4 "success-shaped failure," but it isn't reachable
by any real caller: both current call sites and every documented call
pattern derive `range` from `periodRange()`, which can't produce
`from > to`. Not fixing — adding input validation for an unreachable input
would be speculative hardening outside this track's brief, not a real
defect. Mentioning it only in case a future caller (e.g. History's scope
selector, per the brief's own open question about who drives `series()`'s
range) ever passes a hand-rolled range.

## What I fixed vs. what I'm asking you to decide

**Fixed** (all inside `src/lib/movimientoStats.ts` / `.test.ts`, no public
signature changes, `bun run check` green throughout):

1. Softened `series()`'s doc comment to state the real "to the cent, not
   bit-exact" guarantee instead of overclaiming exact equality.
2. Extended the bucket-range invariant test to the `primerDiaSemana`
   cross-product (was `primerDiaSemana=1` only for all four periods).
3. Added a same-`tipo` multi-bucket invariant test using `toBeCloseTo(…, 2)`,
   proving the real (cent-level) guarantee and documenting why raw `toBe`
   isn't the right tool here.
4. Refactored `bucketStartsFor`/`bucketEndFor` from if-chains to `Record`
   dispatch, matching `RANGE_FOR_PERIODO`'s existing precedent in the same
   file (`AGENTS.md` rule).

**Asking you to decide:** nothing rises to a judgment call in these three
files — no public signature needed to change, nothing cross-cutting inside
my scope. The one thing worth your attention, flagged above rather than
acted on because it's outside `src/lib/`: if Home's or History's chart
component (in `src/features/**`, not mine to touch) ever sums `series()`
bucket values to cross-check against a totals card in a test, know that
comparison isn't bit-exact for fractional multi-bucket same-`tipo` data —
compare to the cent, not with `toBe`.

## Process note

`track-e1.md`'s own report is unusually rigorous — it already ran the exact
kind of adversarial testing this review exists to do (found and fixed the
clamp bug itself, with a watched-failing test, before I ever looked at it).
The one gap was scope of the invariant test's own coverage (one
`primerDiaSemana` value, one nonzero value per `tipo`) rather than a defect
in the fix. Worth naming as a general pattern for future high-rigor tracks:
an invariant test's cross-product coverage (which enum values × how many
nonzero terms) is itself worth a second look, not just whether the
invariant holds for the cases already chosen.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/rv-stats


 Test Files  61 passed (61)
      Tests  581 passed (581)
   Start at  03:01:08
   Duration  10.72s
```

The one lint warning is pre-existing (`src/components/ui/button.tsx`,
shadcn-generated, untouched by this review — same as noted in `track-e1.md`).
