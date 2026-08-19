# Review N — region-aware formatting + the initial currency

Reviewing `git show 80f5142` (Track N implementation) against `specs.md`
§10.7, `AGENTS.md`, `docs/error-handling.md`. Rigor: high — money math, a
frozen schema file, both first-run seeding paths.

## Done-when verification (run, not read)

- `es-MX` seeds `MXN` and groups `1,234.56` — ran
  `new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN',
currencyDisplay:'narrowSymbol'}).format(1234.56)` → `"$1,234.56"`.
  `repo.local.test.ts`/`bootstrap.test.ts` assert `MXN` from an `es-MX`
  device via the real `buildSeedConfig()`/`monedaForRegion()` code path,
  not a hand-written expectation.
- `es-CO` unchanged — `buildSeedConfig('CO')` `toEqual(CONFIG_SEMILLA)`
  (`seedConfig.test.ts`), and ran the CO/COP formatter directly:
  `"$ 1.234,56"`, matching pre-existing behavior.
- Stored config always wins — `repo.local.test.ts` seeds a stored `COP`
  config, stubs the device to `es-MX`, and asserts `monedaPrincipal` stays
  `COP`; `bootstrap.test.ts` does the equivalent by having `findFile`
  resolve `config.json` already-existing and asserting `createJsonFile` is
  never called. Traced `ensureJson`/`findFile`/`createJsonFile` in
  `drive.ts` myself rather than trusting the comment — confirmed
  find-before-create is real: `createJsonFile` is only reached when
  `findFile` resolves `null`.
- Signed amounts across all four locales — reproduced empirically with a
  standalone Node script across `es-CO`/`es-MX`/`en-US`/`pt-BR`/`en-CO`/
  `es-AR`/`de-DE` × `USD`/`BRL`, both `formatToParts` order and rendered
  output; matches `movimientoView.test.ts`'s locale-parametrized
  assertions.
- `bun run check`: **CONFIRMED green**, actually run (output below).

## Findings

1. **CONFIRMED, fixed — `attachSignToNumber`'s no-integer-part fallback
   reproduced the exact bug it closes, for non-finite values.**
   `formatToParts` has no `"integer"` part for `Infinity`/`-Infinity`
   (only a `"nan"`/`"infinity"` part type) — reproduced empirically:
   `formatMontoWithSign(-Infinity, 'COP', 'es-CO')` → `"-$ ∞"`, sign before
   the currency symbol, the identical shape `specs.md §10.7` names as the
   bug to close. `monto` is validated finite at write time
   (`repo.local.ts`'s `validateMovimiento`), so no _stored_ value can
   trigger this, but `totals.balance` is a derived sum that isn't run
   through that same validation, and no future Drive-backed `Repo` is
   guaranteed to re-validate on read (§12: no Drive-backed `Repo` exists
   yet). Low practical severity — I could not construct a realistic path
   from real `Movimiento` data to a non-finite total — but it is a one-line,
   clearly-correct fix, so I did it: wrote a failing test
   (`movimientoView.test.ts`, "attaches the sign to the number even when
   there is no integer part (Infinity)" — watched it fail with `"-$ ∞"` not
   matching the "no leading sign" assertion), then changed the insertion
   point from "first `integer` part" to "first part whose type actually
   renders the number" (`integer`/`nan`/`infinity`, via a
   `NUMERIC_PART_TYPES` set). `bun run check` green after
   (671 tests, was 670).

2. **CONFIRMED — both seeding paths call `buildSeedConfig()`, both are
   find/get-before-write, neither can overwrite an existing config.**
   `repo.local.ts`'s `performReady()` only enters the seed branch when
   `db.config.get(CONFIG_ID)` returns nothing; `bootstrap.ts`'s
   `ensureJson` calls `findFile` before ever calling `createJsonFile`, and
   `buildSeedConfig()` is called eagerly as an argument but its result is
   discarded when `findFile` resolves an id — confirmed by reading
   `drive.ts`, not by trusting the `ensureJson` comment. No third seeding
   path exists in the app's write paths: grepped every `db.config.put`/
   `db.config.add`/`config.json`/`writeJsonFile` in `src/lib` — only the
   two known sites write a `Config`.

3. **CONFIRMED, not a defect — `repo.fake.ts`'s `FAKE_CONFIG` does not call
   `buildSeedConfig()` and stays hardcoded `COP`.** This is not a third,
   missed seeding path: `repo.fake.ts` is the Wave 2 screens' data source
   today (`repoProvider.ts`'s `getRepo()` returns `fakeRepo` unconditionally,
   `// STUB(wave3)`), and §10.7's own "two seeding paths" framing, plus the
   pre-existing §12 backlog entry ("No Drive-backed `Repo` implementation
   exists... every Wave 2 screen reads `repo.fake`"), both scope the fake
   repo out on purpose — it is a fixture, not a first-run persistence path.
   Worth naming explicitly since it means **this feature has no observable
   effect on what the running app shows today** — every screen still reads
   deterministic `CONFIG_SEMILLA`-derived fake data regardless of device
   region, until Wave 3's Drive-backed `Repo` replaces `getRepo()`'s stub.
   Not something Track N should have fixed (out of its two named seeding
   paths), but worth you knowing this is currently inert in the live app.

4. **CONFIRMED — `CONFIG_SEMILLA` is never read at import time in the
   region-dependent path.** Traced the whole graph: `seedConfig.ts`'s only
   region-dependent code is `buildSeedConfig`'s own default parameter
   (`region: string = detectRegion()`), evaluated per-call in JS semantics,
   not at module load; `detectRegion()`'s own defaults similarly resolve
   inside its function body. Grepped for any top-level
   `const x = detectRegion()`/`= buildSeedConfig()` — none exist. This is
   the exact defect shape `specs.md §11` (2026-08-19) records twice; not
   reproduced here.

5. **CONFIRMED — the two formatter caches cannot collide.**
   `currencyFormatters`/`signedCurrencyFormatters` are two separate `Map`
   instances; `cachedFormatter` takes the target map as a parameter. Same
   `${locale}:${moneda}` key string in each map is fine — they're different
   maps, not shared keyspace. Memoization rationale (avoid constructing an
   `Intl.NumberFormat` per row per render) still holds and is asserted by
   spying on `Intl.NumberFormat` across repeat calls in
   `movimientoView.test.ts`.

6. **VERIFIED (your `en-CO` reasoning holds) — reproduced against the real
   runtime, not just CLDR docs.** Ran
   `new Intl.NumberFormat('en-CO', {...}).resolvedOptions().locale` and the
   same for `en-MX`/`en-AR`/`en-BR`/`en-US`: all four resolve to plain
   `"en"` except `en-US` itself, and plain `"en"` formats a currency amount
   identically to `en-US` (`$1,234.50` either way) — confirmed by direct
   `.format()` comparison, not just the resolved-locale string. So the
   literal orthogonal reading you chose is correct: an `en`-copy device in
   region `CO` produces the tag `en-CO`, which `Intl` silently normalizes to
   plain `en`/`en-US`-equivalent grouping — no observable formatting
   regression versus the narrower "region only fills in a copy locale's own
   undefined default" reading you considered and rejected. The only
   consequence of the orthogonal reading is for `es`+non-`CO`/`pt-BR`+
   non-`BR` region combinations, which _do_ change formatting (e.g.
   `es-BR` groups `1,234.50`, distinct from `es-CO`'s `1.234,50`) — and
   that difference is the entire point of the feature.

7. **CONFIRMED — `Moneda`'s widening is genuinely additive; nothing else
   in `schema.ts` moved.** `git show 80f5142 -- src/lib/schema.ts` is a
   single-line diff, widening the union and updating its own inline
   comment. Grepped the whole codebase for `Record<Moneda,` — zero results,
   so no exhaustive lookup silently became partial. The only two
   `Record`/`Map` structures keyed by currency (`movimientoView.ts`'s
   formatter caches) are `Map<string, …>`, not typed by `Moneda`, so they
   were never exhaustive over it and aren't affected by the widening
   either way.

8. **CONFIRMED — `navigator.language(s)` stubbing in `src/test/setup.ts`
   does not mask the region axis.** Region-dependent behavior is exercised
   against several regions, not only the pinned `es-CO` baseline:
   `detectRegion.test.ts`/`detectLocale.test.ts` cover `MX`/`AR`/`BR`/`CO`/
   `US`/the `es-419` UN-M49 edge case; `localeFormatting.test.ts` explicitly
   asserts the `en`+`CO`→`en-CO` combination and an `es-MX` device through
   the real hook (`vi.stubGlobal('navigator', …)`, which the setup file's
   own comment confirms survives `unstubAllGlobals` correctly — verified
   this claim by re-running the suite rather than trusting the comment);
   `repo.local.test.ts`/`bootstrap.test.ts` both stub `es-MX` explicitly to
   prove the seeding path doesn't silently fall back to the ambient
   `es-CO`. The ambient `es-CO` stub is used only as the deliberate
   "unchanged from today" baseline case, which is itself one of the
   Done-when assertions — not a blind spot.

9. **Sweep re-run independently — nothing beyond the track's own finding.**
   `rg "formatMonto|formatMontoWithSign|getMovimientoAmountView"` across
   `src` (non-test): every call site (`BreakdownCard.tsx`, `WeeklyChart.tsx`,
   `BalanceCard.tsx`, `MovimientoRow.tsx`, `movimientoView.ts` itself, the
   `shared` barrel) goes through the shared helpers with no local sign
   handling. `rg "new Intl\.NumberFormat|style:\s*['"]currency['"]"` across
   `src`: one production construction site (`movimientoView.ts`), plus one
   test-only comparison formatter in `Home.test.tsx`. No `'+'`/`'-'` string
   concatenation pattern near a formatted amount anywhere else. Confirms
   the track's own sweep result — nothing else found.

## What I left, and why

- **The track's own "Doc lines to add" were never actually applied to any
  README** — `src/lib/README.md`, `src/lib/i18n/README.md`,
  `src/components/shared/README.md`, `src/features/history/README.md` all
  still lack the `seedConfig.ts`/`regionCurrency.ts`/`detectRegion()`/
  `formatMontoWithSign`/`BreakdownCard.tsx` bullets the track's own report
  (`docs/wave-2.1/track-n.md`) specifies verbatim, file and location. I did
  not add them — my brief explicitly carves out existing folder
  `README.md`s as yours to apply. The exact lines are already written out
  in `docs/wave-2.1/track-n.md`'s "Doc lines to add" section; they just
  need to land.
- **The Infinity/`-Infinity` fallback fix (finding 1)** is the only code
  change beyond the test that proves it — everything else reviewed clean.
- **The zero-income `signDisplay: 'exceptZero'` behavior change**
  (`BreakdownCard`'s empty-period mini-total now reads `$0.00` instead of
  the old forced `+$0.00`) is a judgment call the track already flagged as
  an open question with no pinned prior behavior either way — left for you
  to decide, not something I have grounds to override.
- **The `en`+region-independence Done-when gap** the track flagged
  (§10.7's Done-when line only names `es-MX`/`es-CO`) is addressed by your
  decision in the brief (finding 6) — no code change needed, the behavior
  is already correct and tested.

## Process note

No blind spot in the _implementation_ — the two seeding paths, the
import-time trap, and the sign-attachment primitive were all handled
correctly and tested against multiple values, not just the happy path.
The one process gap is documentation follow-through: the track wrote
precise, ready-to-paste doc lines and then didn't paste them. Worth
naming as a pattern to watch for — "doc lines to add" sections are cheap
to write and easy to treat as done once written, but AGENTS.md's own rule
is "update the README before calling the task done," not "list what the
README should say."

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9

 Test Files  71 passed (71)
      Tests  671 passed (671)
```

The one lint warning is pre-existing in a shadcn-generated file untouched
by this track or this review (confirmed via `git diff`/`git blame`).
