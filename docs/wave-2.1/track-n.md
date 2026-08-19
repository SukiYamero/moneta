# Track N — report

## Decisions made (for specs.md §11)

- **`detectRegion()` lives in `detectLocale.ts`, with its own canonical-region
  fallback table, rather than importing that fallback from
  `localeFormatting.ts`.** `localeFormatting.ts` needs `detectRegion` (for
  `useLocaleFormatting()`), so having `detectRegion`'s fallback also pull
  from `localeFormatting.ts` would create `detectLocale.ts` ⇄
  `localeFormatting.ts` circular imports. `CANONICAL_REGION` in
  `detectLocale.ts` duplicates four `{es: CO, es-AR: AR, en: US, pt-BR: BR}`
  pairs that also exist implicitly in `localeFormatting.ts`'s `FORMATTING`
  table, but only as a rarely-hit fallback (no navigator language subtag at
  all) — the decoupling is worth the four-line duplication.

- **`localeFormatting()`'s `region` parameter has no default**, extending
  the existing "no default locale parameter" rule (specs.md §11,
  2026-08-19) to the new axis. Only one call site exists (the
  `useLocaleFormatting()` hook itself, which supplies `detectRegion()`) —
  confirmed by grep, so this cost nothing in practice, but it means any
  future direct caller of `localeFormatting()` gets a compile error instead
  of a silently wrong default region.

- **Device region, once resolved, is independent of the copy locale even
  when the copy locale changes** — not just "the `es` default stays `CO`".
  Switching only the UI language to `en` on a device whose region is `CO`
  now formats as `en-CO`, not `en-US`. This is what "independent axis"
  demands literally (formatting should follow the _device_, not whichever
  language the user happens to be reading), and I updated the
  pre-existing `localeFormatting.test.ts`/`HistoryScreen.test.tsx` hook
  tests to assert `en-CO` instead of the old `en-US` under a
  CO-region-stubbed device. Flagged again under Spec deltas below — the
  Done-when line only exercises `es`, not this combination.

- **Test infrastructure: `navigator.language`/`navigator.languages` are now
  stubbed to `es-CO` in `src/test/setup.ts`**, extending the file's
  existing "tests must not depend on the runner's ambient locale" comment
  (previously only about `i18next`'s language) to the new region axis —
  jsdom's real default is `en-US`, which would otherwise make every
  region-aware test depend on the test runner rather than the device.
  Implemented via `Object.defineProperty` on the real `navigator` object
  (not `vi.stubGlobal`), because `vi.stubGlobal('navigator', ...)` /
  `vi.unstubAllGlobals()` — the pattern `detectLocale.test.ts` already
  uses per-test — would otherwise wipe a top-level `stubGlobal` default
  after the first test that overrides it. Verified empirically before
  committing to the approach (a throwaway probe test), not just reasoned
  about.

- **`formatMonto`/`getMovimientoAmountView` are rebuilt on
  `Intl.NumberFormat.prototype.formatToParts`, never a prepended
  character**, per the brief. `currencyDisplay: 'narrowSymbol'` is now
  always set (was previously the plain default, which shows the ISO code
  when the currency is "foreign" to the formatting locale). A shared
  `attachSignToNumber(parts)` helper reorders any `minusSign`/`plusSign`
  part to sit immediately before the first `integer` part — this is what
  makes `formatMonto` correct for `totals.balance` (auto sign, only shown
  when negative) and `getMovimientoAmountView` correct for
  always-shown-sign income/expense, off the same primitive.

- **New export: `formatMontoWithSign(monto, moneda, locale)`** — same as
  `formatMonto` but built on a `signDisplay: 'exceptZero'` formatter (shows
  "+" for a positive amount, not just "-" for a negative one).
  `getMovimientoAmountView` is now a thin wrapper over it
  (`signedMonto = tipo === 'ingreso' ? monto : -monto`). Exported because
  the sweep (below) found a second, independent call site with the exact
  same bug shape.

- **`Moneda` widened additively; no `SCHEMA_VERSION` bump, no migration.**
  Confirmed the reasoning myself rather than taking §10.7's word for it:
  `AGENTS.md`'s structural-change rule is rename/split/delete a field —
  adding new members to a union that a stored `moneda: 'COP'`/`'USD'` value
  already satisfies changes no existing value's meaning. Only the one line
  in `schema.ts` changed; verified via `git diff` that nothing else in the
  file moved.

- **`buildSeedConfig(region = detectRegion())` in a new `src/lib/seedConfig.ts`**,
  shared by both seeding paths (`repo.local.ts`'s `performReady()` and
  `bootstrap.ts`). `CONFIG_SEMILLA` itself is untouched at module scope —
  the region-dependent value is computed inside the function body, at call
  time, per the edge case's own reasoning (avoids reproducing the
  "evaluated at import time" defect shape specs.md §11 records twice).

## Sweep: what else formats currency or assumes a currency default

Grepped for `Intl.NumberFormat`/`style: 'currency'` (one construction site:
`movimientoView.ts`, confirmed the single source of truth), and for every
`formatMonto`/`getMovimientoAmountView` call site (6 files).

**Found one real bug beyond the brief's own list:
`src/features/history/BreakdownCard.tsx` had the identical string-prepended-sign
bug** `getMovimientoAmountView` had — `{balanceNegative ? '-' : ''}{formatMonto(...)}`
for the balance figure, and `+{formatMonto(...)}` / `-{formatMonto(...)}` for
the income/expense mini-totals. Same shape, different file: the sign led the
whole string (rendered as a separate DOM text node before the currency
symbol), not attached to the number. Wrote a failing test
(`BreakdownCard.test.tsx`) that reproduced it against the real rendered DOM
before fixing it, per the TDD/verify-before-claiming rules — the two
elements really were separate `+`/`-` and `$ 12.000,00` text nodes.
Fixed by switching the three call sites to `formatMonto`(unsigned, for the
balance — `Math.abs`+conditional no longer needed since `formatMonto` now
handles negative correctly on its own) and the new `formatMontoWithSign`
(for the two mini-totals).

**Nothing else.** `BalanceCard.tsx`, `WeeklyChart.tsx`, and
`MovimientoRow.tsx` all already called `formatMonto`/`getMovimientoAmountView`
directly with no local sign handling.

## Backlog / deferred (for specs.md §12)

- **A device's region isn't persisted, and formatting reads it live on every
  render — not just at seed time.** If a device's OS region changes after
  first run (e.g. travel, or a VPN/locale change), every already-seeded
  amount's _grouping/decimal punctuation_ (not its currency) immediately
  follows the new region on next render — `monedaPrincipal` itself never
  changes (correctly, first-run-only), but a COP amount could start
  rendering with `es-MX`-style `1,234.56` grouping instead of `1.234,56`
  while still showing `$`. §10.7 explicitly puts a region/currency picker
  and multi-currency display out of scope, but doesn't mention this
  live-reformatting edge case. Not a bug relative to the spec as written
  (the spec says region drives the _Intl tag_, and I did exactly that), but
  worth a conscious call before Wave 3's currency/region picker lands —
  PLAUSIBLE UX confusion, not verified against a real device.

- **`BreakdownCard.tsx`'s zero-total edge case changed behavior.** The old
  code always rendered a literal `+` in front of the income mini-total,
  even when `totals.ingresos` is `0` (an empty period). `signDisplay:
'exceptZero'` (used by the new `formatMontoWithSign`) shows no sign at
  all for exactly `0`, so an empty-income period now renders `$0.00` where
  it used to render `+$0.00`. No existing test asserted the old zero
  behavior, so nothing broke, but flagging it as an intentional-but-unasked
  behavior change — see Open questions.

## Doc lines to add (say exactly which file and where)

- **`src/lib/i18n/README.md`**, in the `detectLocale.ts` bullet — append:
  "Also exports `detectRegion()`: the device region (region subtag of
  `navigator.languages`/`navigator.language`), an axis independent of the
  copy locale above, falling back to the copy locale's canonical region
  when no candidate has a subtag (specs.md §10.7)."
- **`src/lib/i18n/README.md`** — new bullet, after the `detectLocale.ts`
  one: "`regionCurrency.ts` — `monedaForRegion(region)`: a `Record`
  lookup from the device region to the initial `Moneda` (`MX`→`MXN`,
  `AR`→`ARS`, `BR`→`BRL`, `PE`→`PEN`, `CO`/unmapped→`COP`, `EC`/`US`→`USD`).
  Used only by `src/lib/seedConfig.ts`'s first-run seed, never to
  reassign an existing `Config`."
- **`src/lib/i18n/README.md`**, "Out of scope here" section — the line "no
  number/currency/date formatting — that's `Intl` at the call site, not
  this table" still holds for formatting itself, but region _detection_
  now does live here; worth a one-clause caveat so it doesn't read as
  contradicting `detectRegion()`'s presence.
- **`src/lib/README.md`**, after the `bootstrap.ts` bullet — new bullet:
  "`seedConfig.ts` — `buildSeedConfig(region = detectRegion())`: the
  first-run `Config` seed, `monedaPrincipal` derived from the device region
  via `regionCurrency.ts`. `CONFIG_SEMILLA` itself stays a static constant;
  this function is what varies. Shared by both seeding paths
  (`repo.local.ts`'s `performReady()`, `bootstrap.ts`) so a fix to one
  can't drift from the other (specs.md §10.7, docs/wave-2.1/track-n.md)."
- **`src/lib/README.md`**, `repo.local.ts` bullet — note the fresh-store
  seed now goes through `buildSeedConfig()`, not a raw `CONFIG_SEMILLA`
  copy.
- **`src/components/shared/README.md`**, `MovimientoRow.tsx` +
  `movimientoView.ts` bullet — note `formatMonto`/`getMovimientoAmountView`
  now always use `currencyDisplay: 'narrowSymbol'` and attach the sign to
  the number via `formatToParts` (not a prepended character); and the new
  exported `formatMontoWithSign` primitive, which any call site needing an
  explicitly-signed amount should use instead of hand-concatenating a
  `+`/`-` (docs/wave-2.1/track-n.md — this is the shape `BreakdownCard.tsx`
  got wrong independently).
- **`src/features/history/README.md`**, `BreakdownCard.tsx` bullet — note
  it now calls `formatMonto`/`formatMontoWithSign` for its balance and
  income/expense mini-totals instead of hand-prepending a sign character
  (fixed alongside `movimientoView.ts`'s identical bug,
  docs/wave-2.1/track-n.md).

## Spec deltas (where §10.7 turned out wrong or underspecified)

- **Underspecified: the Done-when line only tests `es-MX`/`es-CO`, not a
  non-`es` copy locale on a non-default region.** The spec's own framing
  ("this adds a second, independent axis... it does not change which
  language the UI speaks") is unambiguous once followed to its logical end
  — region and copy locale really are orthogonal — but the concrete
  consequence (an `en`-language, `CO`-region device formats as `en-CO`, not
  `en-US`) isn't named anywhere, and it's exactly the kind of thing a
  narrower reading of "es-CO must stay es-CO" could miss or design around
  differently (e.g. "region only overrides the _default_ region, not a
  copy locale's _own_ region"). I went with the literal, orthogonal
  reading and updated the two pre-existing tests that assumed the old
  1:1 copy-locale→tag mapping. **Ask:** confirm this is the intended
  interaction, since it's a real behavior change beyond what the Done-when
  line pins down.
- **Not a defect, but worth naming: the edge case about `CONFIG_SEMILLA`
  staying static is exactly right and I didn't find a way around building
  `buildSeedConfig()` as a genuinely separate function** — there's no
  simpler shape that both keeps the constant static and avoids duplicating
  the "derive currency from region" logic across two seeding paths.
  Confirms the spec's own reasoning rather than contradicting it.

## Open questions for the operator

1. **The `en`+`CO`→`en-CO` interaction above** — confirm intended, or say
   region should only fill in a copy locale's own _undefined_ default
   region (which would make `es`+`CO` device→`es-CO` but `en`+anything
   device→always `en-US`, closer to the old behavior for non-`es`
   locales). I implemented the fully-orthogonal reading.
2. **`BreakdownCard`'s zero-income sign** (Backlog, above) — should an
   empty period's income mini-total show `+$0.00` (old behavior, via a
   forced sign) or `$0.00` (current behavior, via `signDisplay:
'exceptZero'`)? No test pinned the old behavior either way; I kept the
   more standard `exceptZero` semantics rather than special-casing zero.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9

 Test Files  70 passed (70)
      Tests  663 passed (663)
```

The one lint warning is pre-existing, in a shadcn-generated file this track
never touched (confirmed via `git diff` — not in this track's changed-file
list).
