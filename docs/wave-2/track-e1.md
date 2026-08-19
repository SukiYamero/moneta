# Track E1 — report

## Decisions made (for specs.md §11)

- **`movimientoStats.ts` money rule**: every summing function accumulates in
  integer minor units (`Math.round(monto * 100)`) and divides once on the
  way out. `totals()`'s `balance` is computed as `ingresosMinor -
gastosMinor` in minor units, then divided once — not as
  `ingresos - gastos` on two already-divided floats, which can still drift
  (two decimal floats subtracting is not guaranteed exact).
- **`periodRange()`/`series()` date rule**: `fecha` is parsed with
  `date-fns`'s `parseISO`, never `new Date(iso)` — `parseISO` parses a
  date-only string as local midnight; the native constructor parses it as
  UTC midnight, which is one day (and sometimes one month) earlier under
  every negative-offset TZ this app targets. `filterByRange()` needs no
  parsing at all: ISO `yyyy-mm-dd` strings compare lexicographically in
  chronological order, so it's immune to the bug by construction.
- **`series()` bucket granularity is a `Record<Periodo, BucketGranularity>`**,
  not spelled out in the brief beyond "a week needs 7 daily bars." Since
  `fecha` has no time-of-day component, hour-level buckets for `'dia'` are
  impossible from this data, so I settled on: `dia` → 1 bucket (the day
  itself), `semana` → 7 daily buckets, `mes` → weekly buckets (respecting
  `primerDiaSemana`, which is why that param exists on `series()` at all —
  it's otherwise unused for `dia`/`semana`/`anio`), `anio` → 12 monthly
  buckets. This is a judgment call, not something I found written down
  anywhere else — flagging it explicitly below too.
- **`repoProvider.ts`**: kept as its own one-line file, per the brief's
  proposal. See "Question the brief" below for why.

## Backlog / deferred (for specs.md §12)

- Nothing deferred. Everything in the brief's surface is implemented and
  tested.

## Doc lines to add (say exactly which file and where)

`src/lib/README.md`, appended after the `repo.fake.ts` entry:

```
- `movimientoStats.ts` — pure derivation of every number the Home/History/
  Search screens show, from `Movimiento[]` (specs.md §4: views are derived,
  never stored). `periodRange()`, `filterByRange()`, `totals()`,
  `breakdownBy()`, `series()`. No imports from stores/UI/repo — trivially
  testable, reusable by all three screens so their numbers cannot disagree.
  Sums in integer minor units (never a naive float `+=`); dates compared as
  ISO strings or parsed with `date-fns`'s `parseISO` (never
  `new Date(iso)`, which shifts a date-only string by a day under a
  negative-offset TZ).
- `dataStore.ts` — zustand store holding the raw `movimientos`/`activos`/
  `config` the three Wave 2 screens read, plus `status`/`error`. No derived
  totals cached here — screens compute those from `movimientoStats` at the
  call site. `load()` is idempotent and race-safe (mirrors
  `authStore.restore()`'s synchronous check-then-set guard) and owns its
  own error handling end to end: a failure lands in `error` as a
  `RepoErrorCode`, never thrown past `load()`.
- `repoProvider.ts` — the single swap point: `getRepo()` returns the shared
  fake `Repo` today. `// STUB(wave3)` marks the one line to change once a
  Drive-backed `Repo` exists.
```

## Spec deltas (anything where the brief below turned out wrong)

None. The brief's proposed function surface held up as written; the only
gap was granularity detail in `series()`, covered above and in "Question the
brief."

## Open questions for the operator

- Confirm the `series()` granularity choice (`dia`→1, `semana`→7 daily,
  `mes`→weekly, `anio`→12 monthly) matches what Track E2's weekly-bar-chart
  and any future History chart actually need. Home's brief only calls for a
  fixed weekly chart, so in practice it likely calls
  `series(movimientos, 'semana', periodRange('semana', today, primerDiaSemana), primerDiaSemana)`
  directly rather than driving it from the History scope selector — I did
  not build that call site (out of scope for E1), so this is unverified
  against a real consumer.

## Question the brief

**1. Should `repoProvider.ts` exist as its own file, or should `dataStore`
take a `Repo` via `init(repo)`?**

Keeping it as its own file, per the brief's proposal, and I'd go further:
this is the right call, not just an acceptable one. Reasons:

- It is the literal, single line `docs/wave-2-plan.md` §3.2 says Wave 3 needs
  to change to swap in a Drive-backed `Repo`. An `init(repo)` on `dataStore`
  moves that decision into whatever calls `init` — main.tsx, a test, a
  screen — which means the swap point is now "wherever `init` happens to be
  called," not one greppable file. `repoProvider.ts` is strictly more
  discoverable (`// STUB(wave3)` + one export).
- `init(repo)` also reopens a question the brief correctly avoided: what
  does `dataStore` do before `init` is called? Either it needs a nullable
  "not yet configured" state distinct from `'idle'` (extra state for a
  transition that, in this codebase, has exactly one real answer at any
  given time), or every entry point must remember to call `init` first
  (main.tsx, and every test file), which is more ceremony than importing
  `getRepo` already provides for free (it's a plain function, trivially
  swappable with `vi.mock('@/lib/repoProvider', …)` in a test, as
  `dataStore.test.ts` does).
- The brief's own reasoning — "one honest line beats a configurable
  indirection nobody has a second implementation for yet" — is correct and
  I didn't find a case against it. `init(repo)` is exactly that
  indirection, just relocated from a file to a function parameter.

**2. Should `series()` return empty buckets, or should the chart consumer
fill them?**

Agree with the brief: the module fills them, not the chart. "Seven bars for
seven days" (or twelve for a year, or N weeks for a month) is a property of
the _period_, computed from `Periodo` + the date range — a chart component
has no way to know how many buckets a period needs without either
duplicating `periodRange`'s calendar math or importing it anyway, at which
point the bucket-filling logic has just moved to a worse location (a
render-adjacent file, tested via a component test instead of a pure-function
test). Keeping it in `movimientoStats.ts` is also what makes the
cross-screen consistency guarantee hold for any future chart the same way it
holds for `totals()`: Home's weekly chart and a hypothetical History chart
over the same range return bucket-for-bucket identical numbers because they
call the same function, not two independent "fill the gaps" implementations
that could quietly diverge.

## TDD — what was watched failing, and why

**Money (`totals()`)**: wrote `movimientoStats.test.ts`'s money tests
against a deliberately naive first-draft `movimientoStats.ts` (float `+=`
accumulation, `new Date(anchor)` for dates — kept in the diff history via
`bun run test` output below, not committed). The test
`sums 0.1 and 0.2 ingresos to exactly 0.3, not the float-drift result`
failed with:

```
AssertionError: expected 0.30000000000000004 to be 0.3 // Object.is equality
```

— the exact float-drift bug the money rule exists to prevent. Fixed by
switching `totals()`/`breakdownBy()`/`series()` to integer-minor-unit
accumulation; the test then passed.

**Timezone (`periodRange()`)**: same naive draft, run under
`vi.stubEnv('TZ', 'America/Bogota')`. The test
`does not shift a month-boundary anchor under a negative-offset TZ` (anchor
`'2026-09-01'`, expecting the `'mes'` range `{ from: '2026-09-01', to:
'2026-09-30' }`) failed with:

```
AssertionError: expected { from: '2026-09-01', to: '2026-09-30' } to deeply equal { from: '2026-08-01', to: '2026-08-31' }
```

`new Date('2026-09-01')` parsed as UTC midnight, which under
`America/Bogota` (UTC-5) is `2026-08-31` local — an entire month early. The
companion test (a movement dated `2026-08-31` vs. one dated `2026-09-01`,
filtered by the `'mes'` range for anchor `'2026-09-01'`) failed the same way:
the August movement was included instead of the September one. Fixed by
parsing with `date-fns`'s `parseISO` (local midnight for a date-only
string) instead of the native constructor; both tests then passed.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/stats


 Test Files  37 passed (37)
      Tests  378 passed (378)
   Start at  01:45:36
   Duration  5.68s
```

The one lint warning is pre-existing in `src/components/ui/button.tsx`
(shadcn-generated, outside this track's scope — untouched by this diff).

## Public surface (final)

```ts
// movimientoStats.ts — pure, no imports from stores/UI/repo
periodRange(periodo: Periodo, anchor: string, primerDiaSemana: 0 | 1): { from: string; to: string }
filterByRange(movimientos: Movimiento[], range: { from: string; to: string }): Movimiento[]
totals(movimientos: Movimiento[]): { ingresos: number; gastos: number; balance: number }
breakdownBy(movimientos: Movimiento[], groupKey: 'seccion' | 'categoria', tipo?: Movimiento['tipo']): { key: string; total: number; share: number }[]
series(movimientos: Movimiento[], periodo: Periodo, range: { from: string; to: string }, primerDiaSemana: 0 | 1): { bucketStart: string; ingresos: number; gastos: number }[]

// dataStore.ts
useDataStore: {
  movimientos: Movimiento[]
  activos: Activo[]
  config: Config | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: RepoErrorCode | null
  load: () => Promise<void>
}

// repoProvider.ts
getRepo(): Repo
```
