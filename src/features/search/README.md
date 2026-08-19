# src/features/search

The Search screen and its Filter sheet. Reads exclusively through
`useDataStore` (`@/lib/dataStore`) — never its own repo call — so its
results can never disagree with Home/History; every number here is derived
client-side from the same `Movimiento[]` those screens read.

- `SearchScreen.tsx` — the routed screen (`/search`, no props — the stable
  contract `router.tsx` builds against). Debounced text search + active
  filter chips + results as `MovimientoRow` + the Filter sheet. Renders one
  of four states depending on `dataStore.status`/data: loading, inline
  error with retry (`role="alert"`, per `docs/error-handling.md`), "no data
  at all" (brand-new user, zero `movimientos`), or the normal list/"no
  results" pair. **"No data" and "no results" are deliberately two
  different empty states** — telling a new user their search matched
  nothing when they have no movements at all is the wrong message.
  A search result row has no `onClick` yet — `// STUB(trackF)`: the
  Movement view/edit sheet doesn't exist until Wave 3. Calls
  `useLocaleFormatting()` for the custom-range chip's date formatting and
  for `MovimientoRow`'s `locale`/`dateFnsLocale` props
  (`docs/wave-2/track-m.md`).
- `FilterSheet.tsx` — `BottomSheet`-based date range (presets +
  `DateChipPicker` for `custom`), type (`SegmentedControl`), and tag
  (`TagChip`, multi-select) filters. No separate "apply" step: every tap
  writes straight into `useSearchFilters`'s shared state, so the result
  list and this sheet's own "Ver N resultados" button update live,
  matching the source design. `FilterSheetProps` takes required `locale`/
  `dateFnsLocale`, forwarded from `SearchScreen` to `DateChipPicker`.
- `useSearchFilters.ts` — owns every filter dimension (debounced query,
  date-range preset + custom bounds, type, tags) in one hook so
  `SearchScreen` and `FilterSheet` always read the same live state.
  `isFilterActive` and `dateRange` (resolved via `dateRangePresets.ts`) are
  derived, not stored twice.
- `dateRangePresets.ts` — pure preset → `DateRange` resolution
  (`movimientoStats.DateRange`) for `all`/`7d`/`30d`/`month`/`year`/
  `custom`. `all` resolves to `null` (no filter), not a sentinel range. A
  reversed custom range (user tapped the later day first) is swapped, not
  rejected.
- `searchCopy.ts` — the `DateRangePreset` → `search.filters.dateRange.*`
  translation-key lookup, typed off `es.json` the same way
  `src/features/auth/errorCopy.ts` types its own — shared by `FilterSheet`
  and `SearchScreen`'s active-filter chip so the two surfaces can't drift
  on wording.
- `searchMatch.ts` — accent- and case-insensitive substring match
  (`String.normalize('NFD')` stripping combining marks, not
  `Intl.Collator`, which compares whole-string equality/order rather than
  containment). `matchesQuery('camion', 'Viaje en camión')` is `true`. The
  combining-marks range is written as `\uXXXX` escapes, never literal
  combining characters, so the class stays legible and immune to the
  source file ever getting normalized to NFC. **`ñ` also folds to `n`** —
  `ñ` decomposes under NFD same as an accented letter, so technically this
  over-folds (`ñ` is its own letter in Spanish, not accented `n`). Left as
  is, deliberately: for search the direction is safe — the match set only
  grows, so a user without an `ñ` key still finds the row, and it can
  never cause a miss.
- `useDebouncedQuery.ts` — debounces the search query, but commits an empty
  query immediately — clearing the input must never leave the previous,
  now-stale filtered list on screen for the rest of the debounce window.

## Filter state and the URL

Filter state (query/range/type/tags) is **not** synced to the URL query
string. Considered and rejected: this screen has no shareable destination
downstream (opening a result is a `// STUB(trackF)` no-op until the
Movement sheet exists in Wave 3, so there is nothing to deep-link _to_
yet), and syncing correctly would need per-field push/replace semantics —
`replace` on every keystroke of the debounced query (or the back button
would step through individual letters) but `push` on a discrete filter
change — which is real complexity for a benefit (mobile back-button restoring
transient search text across an unrelated tab switch) nothing else in this
wave depends on. Revisit once a screen actually links into a specific
search, not before.
