# src/features/history

The `/history` screen (Track E4, Wave 2 stage 3): browse movements by
day/week/month/year, with a balance + "por etiqueta" (by category) breakdown
and the movements list for the currently viewed period.

- `HistoryScreen.tsx` — route-level screen mounted at `/history` as a child
  of `AppShell` (`src/router.tsx`, inside `RequireAuth`). Named export, no
  props — that is the stable contract `src/router.tsx` builds against.
  Reads through `useDataStore` (same instance as Home/Search) and derives
  every number via `movimientoStats.ts` (`periodRange`/`filterByRange`/
  `totals`/`breakdownBy`) — it never computes a total or a share itself.
  Enters with `animate-push-in` (a route push, not a fade — History is a
  sibling tab under the persistent `BottomNav`, not an overlay on Home,
  despite the design drawing it as one).
- `useHistoryPeriod.ts` — owns only "which period is the user looking at":
  a `scope: Periodo` plus an `anchor` ISO date. `step()` moves the anchor by
  one calendar unit (day/week/month/year) via date-fns' `add*` functions,
  which correctly clamp month/year-end overflow; `periodRange` (called by
  the screen, not this hook) resolves the exact bounds every time, so
  stepping can never drift out of sync with the range it produces.
- `historyPeriodOptions.ts` — pure builders for the day/week/month/year
  picker chip lists (`buildDayOptions`/`buildWeekOptions`/`buildMonthOptions`/
  `buildYearOptions`). Every chip's own bounds and "has data" flag are
  resolved via `periodRange`/`filterByRange`, never hand-rolled — a chip can
  never disagree with the range it jumps to.
- `historyPeriodLabel.ts` — pure header title/subtitle formatting
  (`getPeriodLabel`) over an already-resolved `DateRange`; never recomputes
  boundaries.
- `PeriodPickerRow.tsx` — the horizontally scrollable chip strip shared by
  the day/week/month pickers (`anio` has no strip, only the year menu).
- `YearMenu.tsx` — small inline popover (not a `BottomSheet`/`CenterModal`):
  uses `useEscapeToClose` + an outside-pointerdown listener, mirroring
  `DateChipPicker`'s own popover — this is an anchored menu, not a modal, so
  it doesn't need `useOverlay`'s full focus-trap/scroll-lock shell.
- `BreakdownCard.tsx` — balance + income/expense mini-totals + the
  gasto/ingreso `SegmentedControl` tabs and progress-bar breakdown, driven
  entirely by `breakdownBy()`'s `BreakdownEntry[]` (`share` is never
  recomputed locally).

Not built: a hide/show-amounts toggle (the design draws one) — masking the
movements list would need a prop `MovimientoRow` doesn't have, and adding
one is a shared-component change outside this track's file ownership; left
for whichever track next touches `MovimientoRow`. See
`docs/wave-2/track-e4.md` for the full list of decisions/deferrals.
