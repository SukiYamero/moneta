# src/features/search

The Search screen and its Filter sheet. Reads exclusively through `useDataStore`
(`@/lib/dataStore`) — never its own repo call — so results stay consistent with
Home/History.

- `SearchScreen.tsx` — routed at `/search`. Debounced text search + active
  filter chips + results as `MovimientoRow` + the Filter sheet. Renders
  loading, inline error (`InlineErrorState`, message from `repoErrorCopyKey`),
  "no data at all" vs. "no results" (two distinct empty states), or the
  results list, based on `dataStore.status`/data. A row tap opens the
  movement sheet via `useMovimientoSheetStore().openMovimiento(id)`. Matches
  a movement's `nota` and its category's resolved name via `searchMatch.ts`.
  Loading state is `SearchLoadingState.tsx`, gated behind `usePendingDelay`.
- `FilterSheet.tsx` — `BottomSheet`-based date range (presets +
  `DateChipPicker` for `custom`), type (`SegmentedControl`), and tag
  (`TagChip`, multi-select) filters. No "apply" step — every tap writes
  straight into `useSearchFilters`'s shared state. `selectedTags` holds
  category ids, not names.
- `useSearchFilters.ts` — owns every filter dimension (debounced query,
  date-range preset + custom bounds, type, tags) in one hook shared by
  `SearchScreen` and `FilterSheet`. `isFilterActive` and `dateRange` are
  derived, not stored.
- `dateRangePresets.ts` — pure preset → `DateRange` resolution for
  `all`/`7d`/`30d`/`month`/`year`/`custom`. `all` resolves to `null`. A
  reversed custom range (later day tapped first) is swapped, not rejected.
- `searchCopy.ts` — `DateRangePreset` → translation-key lookup, shared by
  `FilterSheet` and `SearchScreen`'s active-filter chip.
- `searchMatch.ts` — accent- and case-insensitive substring match via NFD
  decomposition (not `Intl.Collator`, which isn't substring-safe). `ñ` folds
  to `n` too (a deliberate over-fold: widens matches, never causes a miss).
- `useDebouncedQuery.ts` — debounces the query, but commits an empty query
  immediately so clearing the input never leaves a stale result list on screen.

Filter state (query/range/type/tags) is not synced to the URL — this screen
has no shareable destination to deep-link to (a result opens the movement
sheet in place, it never navigates).
