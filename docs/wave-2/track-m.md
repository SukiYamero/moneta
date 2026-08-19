# Track M — report

## Decisions made (for specs.md §11)

- **Removed the `es-CO`/`es` defaults instead of keeping them.**
  `formatMonto(monto, moneda, locale)` and `getMovimientoAmountView(m,
locale)` (`src/components/shared/movimientoView.ts`) now require `locale`
  — no default. `MovimientoRow`'s `locale`/`dateFnsLocale` props
  (`src/components/shared/MovimientoRow.tsx`) are required, not optional.
  Same for the new `DateChipPicker` props (below), `homeView.ts`'s
  `shortDayLabel`/`narrowDayLabel`/`monthYearLabel`/`buildWeekStripDays`,
  `historyPeriodLabel.ts`'s `getPeriodLabel`, and `historyPeriodOptions.ts`'s
  `buildDayOptions`/`buildWeekOptions`/`buildMonthOptions`.

  **Reasoning weighed:** the review-k defaults existed so the review's
  additive, zero-regression change didn't need to touch call sites it
  wasn't scoped to touch — a legitimate reason _then_. This track's whole
  job is to touch every call site, so that reason no longer applies, and
  the brief's own framing ("a defaulted parameter nobody passes is the bug,
  not the fix") is exactly what happened: the review shipped the
  locale-aware shape, and the default silently let every real screen keep
  calling the old, wrong way — which is precisely what my sweep found
  unchanged. Removing the default turns "a future call site forgets to
  wire locale" into a `tsc` compile error instead of a silent es-CO
  regression a screenshot diff might not even catch (the design is
  Colombian-shaped regardless of locale — a missed wire-up doesn't look
  broken, it looks like "the seed data happens to be COP"). The cost is
  the two-line touch to `src/routes/Kit.tsx` (below) and heavier args in
  ~10 test files — both one-time, mechanical, and now compiler-enforced
  against recurring. Ergonomics lost: none observed — every real call site
  already had `useLocaleFormatting()` in scope or one hook-call away.

- **`DateChipPicker`'s day+month chip label switched from a date-fns
  pattern to `Intl.DateTimeFormat`.** Found while writing the locale-switch
  test for it (not in the operator's inventory — see Spec deltas): the
  existing pattern `"d 'de' MMMM"` bakes the Spanish connector word `"de"`
  into the template as a **literal**, which date-fns' `Locale` object does
  not translate — feeding it `enUS` produced `"10 de August"`, a
  mixed-language string, not `"August 10"`. `Intl.DateTimeFormat(locale, {
day: 'numeric', month: 'long' })` localizes the whole phrase (`"10 de
agosto"` es/pt-BR, `"August 10"` en), because that's what the API is for
  — day/month ordering and connector words are locale data, not something
  a single date-fns pattern string can parametrize. This is why
  `DateChipPicker` now takes **both** `locale` (BCP-47, for the chip label)
  and `dateFnsLocale` (for the month header / weekday captions, whose
  patterns have no embedded literal words and are correctly localized by
  date-fns already) — the same two-prop shape `MovimientoRow` already
  established for the identical reason (money needs `Intl`, dates need
  date-fns).

- **`BalanceCard`/`WeeklyChart`/`BreakdownCard`/`RecentMovimientos`/
  `HistoryScreen`/`SearchScreen` call `useLocaleFormatting()` directly**
  rather than threading `locale`/`dateFnsLocale` down from `Home.tsx`/
  `useHomeDashboard`. These are already leaf render components each
  independently calling `useTranslation()` for copy — calling the sibling
  locale-formatting hook the same way keeps the pattern consistent and
  avoids adding fields to `HomeDashboard`'s return contract that would just
  duplicate what the hook already gives any component for free.
  `useHomeDashboard.ts` still calls the hook itself, but only because it
  needs `dateFnsLocale` for its own derived `monthLabel`/`weekStripDays`
  values.

## Backlog / deferred (for specs.md §12)

- **`DateChipPicker`'s aria-labels ("Mes anterior", "Mes siguiente",
  "Selector de fecha") and the "Selector de fecha" `aria-label` are still
  hardcoded Spanish literals**, not `t()` lookups. Out of this track's
  scope (this track is date-fns/Intl formatting, not i18next copy — the
  component has no assigned locale namespace and adding one is a
  string-translation task, not a formatter-wiring one), but it means a
  non-Spanish screen reader user still hears Spanish button names in the
  Search filter sheet's custom date range. Whoever next touches
  `DateChipPicker` for i18n copy should pick a namespace (`common`? a new
  `dateChipPicker`?) and retrofit these the way Track I retrofitted
  `WelcomeScreen`/`DrivePermissionScreen`.

## Doc lines to add (say exactly which file and where)

- **`src/components/shared/README.md`**, in the `MovimientoRow.tsx` +
  `movimientoView.ts` bullet — replace the sentence review-k asked to be
  appended ("Both now also accept an optional `locale`/`dateFnsLocale`...
  No screen passes a non-default value yet.") with: `formatMonto`/
  `getMovimientoAmountView` and `MovimientoRow`'s `locale`/`dateFnsLocale`
  are now **required**, not optional/defaulted — every Home/Search/History
  call site passes the active locale via `useLocaleFormatting()`
  (`src/lib/i18n/localeFormatting.ts`); a missed call site is a compile
  error, not a silent es-CO fallback (`docs/wave-2/track-m.md`).
- **`src/components/shared/README.md`**, in the `DateChipPicker.tsx`
  bullet — add: takes required `locale` (BCP-47, used via
  `Intl.DateTimeFormat` for the day+month chip label — a date-fns pattern
  can't localize the day/month connector word, only the month name) and
  `dateFnsLocale` (for the month header and weekday captions, which have
  no embedded literal words). Both forwarded by the calling screen from
  `useLocaleFormatting()`.
- **`src/features/home/README.md`** — note that `homeView.ts`'s
  `shortDayLabel`/`narrowDayLabel`/`monthYearLabel`/`buildWeekStripDays`
  now take a required `Locale` parameter (`useHomeDashboard.ts` supplies it
  via `useLocaleFormatting()`), and that `BalanceCard`/`WeeklyChart`/
  `RecentMovimientos` each call `useLocaleFormatting()` directly for
  `formatMonto`/date labels rather than receiving it as a prop.
- **`src/features/history/README.md`** — note that `getPeriodLabel`
  (`historyPeriodLabel.ts`) and `buildDayOptions`/`buildWeekOptions`/
  `buildMonthOptions` (`historyPeriodOptions.ts`) now take a required
  `Locale` parameter, and `HistoryScreen`/`BreakdownCard` call
  `useLocaleFormatting()` for it and for `formatMonto`.
- **`src/features/search/README.md`** — note `SearchScreen` calls
  `useLocaleFormatting()` for the custom-range chip's date formatting and
  `MovimientoRow`'s locale props, and that `FilterSheetProps` gained
  `locale`/`dateFnsLocale`, forwarded to `DateChipPicker`.

## Spec deltas (anything where the brief below turned out wrong)

- **The inventory was accurate for `date-fns/locale` and `formatMonto`
  grep targets — re-running both greps found exactly the brief's list,
  nothing extra, nothing missing.** CONFIRMED (ran `rg "date-fns/locale"
src` and `rg "formatMonto|getMovimientoAmountView" src` myself before
  writing any code).
- **The brief did not anticipate `DateChipPicker`'s literal-connector-word
  bug** (above) — it framed the fix as "thread the existing `dateFnsLocale`
  through," which is correct for the month header and weekday captions but
  silently wrong for the chip's own day+month label. This is a finding
  about the brief's scoping, not a defect in the brief's reasoning: the
  inventory was built by grepping for `date-fns/locale` imports, which
  correctly finds every file needing a locale parameter, but can't surface
  that one of those files' _format pattern itself_ embeds a
  locale-specific literal. CONFIRMED (reproduced: `format(date, "d 'de'
MMMM", { locale: enUS })` → `"10 de August"`, verified in a scratch
  `node -e` call and then in `DateChipPicker.test.tsx`'s new locale test).

## Open questions for the operator

- None blocking. The one judgment call in the brief (remove vs. keep the
  defaults) is made and argued above; happy to revisit if you weigh the
  Kit.tsx/test-file churn differently.
