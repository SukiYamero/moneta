# Track E3 — Search + Filter sheet — report

## What was built

`src/features/search/**` (`SearchScreen.tsx` replacing the placeholder,
`FilterSheet.tsx`, `useSearchFilters.ts`, `dateRangePresets.ts`,
`searchCopy.ts`, `searchMatch.ts`, `useDebouncedQuery.ts`, plus a test file
per module) and the `search` namespace filled in all four locale files.
`SearchScreen` keeps its stable no-props export; router/shell untouched.

Reads exclusively through `useDataStore`; filtering (text, date range,
type, tags) is client-side over the already-loaded `movimientos`, combined
with AND. Search input is debounced (250ms) but clearing it commits
immediately (`useDebouncedQuery`), so the result list can never strand a
stale, pre-clear set on screen. Text matching is accent- and
case-insensitive via NFD normalization — tested against the exact
"camion"/"camión" case. Two distinct empty states exist: "no data at all"
(brand-new user, `movimientos.length === 0`) vs. "no results" (a query or
filter narrowed to zero) — the copy and the condition that picks between
them are both different, on purpose.

## Decisions made (for specs.md §11)

- **Filter state stays out of the URL query string.** See "Question the
  brief" below — full reasoning, not a silent skip.
- **Debounce commits immediately on clear.** `useDebouncedQuery` special-cases
  an empty string to bypass the timer, rather than a generic debounce hook —
  otherwise hitting the clear (×) button would leave the previous filtered
  list on screen for the rest of the debounce window, which reads as a bug
  even though it's "working as debounced."
- **Accent-insensitive matching uses `String.normalize('NFD')` + combining-mark
  strip, not `Intl.Collator`.** `Collator` compares two whole strings for
  equality/order; it has no substring-containment mode, so it doesn't fit
  "does this field contain the query" at all.
- **A custom date range with `from` after `to` is swapped, not rejected**
  (`dateRangePresets.resolveDateRange`) — the user tapping the later day
  first is a normal interaction with two independent `DateChipPicker`s
  (unlike the design's two-tap single calendar), not an error state.
- **Tag filter chips list every category from `Config.categorias`**, not
  only categories present in the currently-loaded movements — matches the
  source design (`allTagNames` in the class component) and avoids the
  filter list itself changing shape as other filters narrow the set.
- **Search result rows have no `onClick`.** The Movement view/edit sheet is
  Track F, Wave 3. Marked `// STUB(trackF)` at the render site rather than
  wiring a dead handler or inventing a placeholder sheet.

## Question the brief

**Filter state in the URL query string — decided against, cheap or not.**
The brief said "if you judge it not worth it, say why rather than silently
skipping it." Reasoning:

1. **There is nothing downstream to link to yet.** Tapping a search result
   does nothing this wave (Movement sheet is Track F, Wave 3) — so there is
   no "share this exact filtered search" or "open this exact result" use
   case for the URL to serve today. Wiring the URL now optimizes for a
   destination that doesn't exist.
2. **Doing it correctly is not actually cheap.** The debounced text query
   would need `replace` semantics on every keystroke (or the back button
   steps through individual letters typed), while a discrete filter change
   (a tag tap, a preset tap) should be `push` (so back usefully undoes one
   filter action) — two different history-write strategies for two kinds of
   state changing in the same hook, plus keeping that in sync with
   `useSearchFilters`'s existing "one hook, one source of truth" design.
   That is real, correctness-sensitive complexity, not a one-line
   `useSearchParams` swap.
3. **The marginal benefit is narrow for this app's navigation model.**
   `BottomNav` is a persistent tab bar, not a push stack — switching tabs
   and back is the only "back button" scenario in play, and losing
   in-progress search text across an unrelated tab switch is a minor rough
   edge, not a broken flow.

Verdict: skipped, and the `src/features/search/README.md` "Filter state and
the URL" section records the same reasoning so it isn't rediscovered as an
oversight. Revisit once a screen actually deep-links into a specific
search — Track F wiring `onOpen` on a result row would also be a natural
moment to revisit the URL question, since that's when a "shareable search"
use case would first exist.

**`movimientoStats` surface**: nothing missing. `filterByRange`/`DateRange`
covers exactly what date-range filtering needs; no local reimplementation
of anything that belongs there.

## Backlog / deferred (for specs.md §12)

- Search result rows are display-only (`// STUB(trackF)`) — wiring
  `onClick` to open the Movement view/edit sheet is Track F's job once that
  sheet exists.
- Revisit URL-synced filter state once Track F gives Search something to
  deep-link to (see "Question the brief" above).

## Doc lines to add (say exactly which file and where)

Nothing outside `src/features/search/README.md` (new file, already
written) — `router.tsx`/`AppShell.tsx` are untouched by this track, so
`src/routes/README.md` needs no update.

## Spec deltas (anything where the brief below turned out wrong)

None — the brief's spec (search input, active chips, `MovimientoRow`
results, real empty state, Filter sheet with date/type/tag filters, reads
through `dataStore`) matched what the design actually needed once read
directly.

## Open questions for the operator

None outstanding.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/search

 Test Files  52 passed (52)
      Tests  509 passed (509)
   Start at  02:41:41
   Duration  10.71s (transform 1.49s, setup 11.55s, import 25.73s, tests 12.21s, environment 36.45s)
```

The one lint warning is pre-existing in `src/components/ui/button.tsx`
(shadcn-generated, untouched by this diff).
