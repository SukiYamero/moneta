# src/features/history

The `/history` screen: browse movements by day/week/month/year, with a
balance + category breakdown and the movements list for the viewed period.

- `HistoryScreen.tsx` — route-level screen mounted at `/history` inside
  `AppShell`. Reads through `useDataStore` and derives every number via
  `movimientoStats.ts` (`periodRange`/`filterByRange`/`totals`/`breakdownBy`),
  scoped to `Config.preferencias.monedaPrincipal`. The breakdown/movements
  region switches between `HistoryLoadingState`, an inline error, an
  empty-period state, and real content; the period nav/scope tabs/picker
  strip render unconditionally. Row taps open the movement sheet via
  `useMovimientoSheetStore().openMovimiento(id)`.
- `useHistoryPeriod.ts` — owns which period is being viewed: a `scope:
Periodo` plus an `anchor` ISO date. `step()` moves the anchor by one
  calendar unit via date-fns' `add*` functions.
- `historyPeriodOptions.ts` — pure builders for the day/week/month/year
  picker chip lists (`buildDayOptions`/`buildWeekOptions`/`buildMonthOptions`/
  `buildYearOptions`), each resolved via `periodRange`/`filterByRange`.
- `historyPeriodLabel.ts` — pure header title/subtitle formatting
  (`getPeriodLabel`) over an already-resolved `DateRange`.
- `PeriodPickerRow.tsx` — the horizontally scrollable chip strip shared by
  the day/week/month pickers (the year scope uses `YearMenu` instead).
- `YearMenu.tsx` — small inline popover (`useEscapeToClose` + an outside-
  pointerdown listener, same pattern as `DateChipPicker`'s popover).
- `BreakdownCard.tsx` — balance + income/expense mini-totals, the
  gasto/ingreso `SegmentedControl` tabs, and the progress-bar breakdown,
  driven by `breakdownBy()`'s `BreakdownEntry[]`. Resolves category ids via
  `movimientoView.resolveCategoria`. Renders an `otherCurrencyNote` line
  when the period has movements outside `monedaPrincipal`.
- `HistoryLoadingState.tsx` — skeleton for the breakdown/movements region.
