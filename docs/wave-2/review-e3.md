# Review — Track E3 (Search + Filter sheet)

Resumes after a prior run of this same review was killed mid-edit by a
machine shutdown; its partial work survived as `wip(review-e3): interrupted
review pass` and is folded into this review's findings below (verified
independently, not trusted as-is).

## Done-when verification (ran, not read)

All items from `docs/wave-2-plan.md` §4 confirmed by running the suite and
exercising the flows through the existing tests: typing narrows results
(debounced); date/type/tag filters each narrow and combine (AND); clearing
restores the full list; both empty states render and are distinct ("no
data" vs "no results"); accent-/case-insensitivity is tested against the
literal "camion"/"camión" case. `bun run check` is green — see bottom.

## Findings

### 1. CONFIRMED — the "no results" message named the still-typing query, not the one that actually produced the empty result set

`SearchScreen` filters off `filters.debouncedQuery` but the empty-state
message interpolated raw `filters.query`. During the debounce window, if
the user keeps typing after the list has already gone empty, the message
updates on every keystroke while the actual filtered (stale) list doesn't
— e.g. type "zzz", wait for "No encontramos 'zzz'", type "q": the message
instantly becomes "No encontramos 'zzzq'" even though "zzzq" was never
searched (still 250ms from committing). Reproduced directly: reverted the
fix, watched the test fail rendering `"zzzq"` where `"zzz"` was expected,
restored it, watched it pass. Fixed by naming `filters.debouncedQuery`
instead (`SearchScreen.tsx`).

This is the WIP's finding — verified as a real bug, not rediscovered
independently, and kept as-is (the fix itself was already correct).

**The WIP's test used `fireEvent.change` + fake timers, against
`AGENTS.md`'s "user-event, never fireEvent" rule.** Its own comment argued
fake timers were unavoidable because `user-event` "cannot be sequenced
against a specific elapsed-ms boundary." That justification doesn't hold:
tried `userEvent.setup({ delay: null })` and `userEvent.setup({
advanceTimers: vi.advanceTimersByTime })` first (the two documented ways to
pair `user-event` with `vi.useFakeTimers()`) — both hung for the full 5s
test timeout and left the fake-timer state leaking into every later test in
the file (8 subsequent failures, all timeouts). Root cause not chased
further since a clean alternative exists: the assertion doesn't need fake
timers at all. Real timers + `await user.type(...)` + `waitFor(...)` for
the settle, then a second `user.type` with **no `await` gap** before the
assertion, exercises the identical race (debounced value vs. raw input)
deterministically, because nothing yields between the second keystroke
landing and the synchronous `expect` right after. Rewrote the test this
way; watched it fail against the pre-fix code (rendered `"zzzq"`) for the
right reason, then pass. `fireEvent` and fake timers are both gone from
this file now.

### 2. CONFIRMED — `SearchScreen`'s own `<main>` duplicated the shell's bottom-nav clearance

Flagged as an open item in `docs/wave-2/review-l.md` ("another reviewer
held that file at the time") — `AppShell`'s scroll pane already applies
`pb-(--bottom-nav-clearance)` to every routed screen (fixed there in the
Track L review), but `SearchScreen.tsx`'s own `<main>` carried a second
copy. Verified directly: `git show main:.../AppShell.tsx` line 13 has the
pane's clearance; `HistoryScreen.tsx`'s equivalent `<main>` has no
nav-clearance padding of its own (`pb-6` or none, unrelated to the token);
`Home` doesn't either. Search was the odd one out, doubling the reserved
space under the nav on that one screen. Removed. Added a test asserting
`SearchScreen`'s `<main>` never reintroduces the token — watched it fail
with the padding present, pass with it removed.

### 3. Real, but out of scope — style-rule violation in `dateRangePresets.resolveDateRange`

`resolveDateRange` dispatched on `DateRangePreset` via a five-branch
`if`-chain, which is exactly the shape `AGENTS.md` bans ("pure value →
value mappings use a lookup table / `Record`, never `switch` or `if/else`
chains") and exactly the shape `src/lib/movimientoStats.ts`'s
`RANGE_FOR_PERIODO` already establishes as the house pattern for "enum →
per-key computation over extra args." Converted to
`RESOLVER_FOR_PRESET: Record<DateRangePreset, (today, custom) => DateRange
| null>`, same technique. Behavior-preserving (all 7
`dateRangePresets.test.ts` cases pass unchanged) so no new test was needed
beyond the existing suite; ran it before and after to confirm identical
output.

### 4. PLAUSIBLE, not fixed — `SearchScreen`'s custom-range chip label hardcodes `es` for date-fns formatting

`SearchScreen.tsx` imports `es` from `date-fns/locale` and uses it
unconditionally when formatting the custom date-range's active-filter chip
label (`format(parseISO(filters.customFrom), 'd MMM', { locale: es })`).
Same defect shape as the `movimientoView.ts`/`MovimientoRow.tsx` case this
review was told is explicitly out of scope and operator-owned. `main` moved
twice during this review: `feat(i18n): map the active locale to Intl and
date-fns formatting` (the promised follow-up hook, `useLocaleFormatting`)
landed, and — after this finding was already written — so did
`docs(wave-2): brief track M, the locale-formatting sweep the K review
scoped too narrowly`, whose own independent inventory names
`SearchScreen.tsx` explicitly under "Dates" needing the hook. So this is
already found and scheduled by the operator (Track M, stage 5, dispatched
during this review) — not left as a loose recommendation. Correctly not
fixed here either way: as of the hook landing, nothing calls
`useLocaleFormatting()` yet anywhere (`MovimientoRow`'s `dateFnsLocale`
still defaults to hardcoded `es`, unpassed by every screen), so a one-off
fix to just this chip label would be a partial, inconsistent result ahead
of Track M's full pass.

## Shape sweep

Touch targets: searched the rest of `src/features/search/**` for the same
"small visual pill/icon _is_ the whole button" shape the WIP fixed on the
clear-search button and the active filter chip. Nothing else matches:
`FilterSheet.tsx`'s date-preset buttons, its type `SegmentedControl`, its
`clear`/`apply` buttons, and `SearchScreen`'s own filter-toggle and retry
buttons all size the button itself to `min-h-11` directly (no smaller inner
visual needing the invisible-padding split). The tag filter and the type
selector reuse the already-fixed shared `TagChip`/`SegmentedControl`
(§10.5.1); `FilterSheet` reuses `BottomSheet`, which reuses `useOverlay` —
neither reimplements Escape/focus-trap/scroll-lock. Confirmed the fixed
chip button follows the same convention as the shared `TagChip`
(`min-h-11` only, no `min-w-11` — text pills grow wide enough on their own)
and the fixed clear-search button follows the same convention as
`InfoButton` (`min-h-11 min-w-11` — square icon buttons need both).

`filters.query` vs `filters.debouncedQuery`: grepped every use in
`SearchScreen.tsx`. The two remaining `filters.query` reads (the controlled
`<input value>` and the clear-button's visibility condition) are correctly
un-debounced — they must reflect what's currently typed, not the committed
filter. The empty-state message was the only site with the mismatch.

Locale-hardcoding (finding 4): grepped `date-fns/locale` imports across
`src/`. It's a pre-existing, widespread shape (`Home`, `History`,
`DateChipPicker`, `MovimientoRow`, and now this one site in `Search`), not
something this track introduced in isolation — consistent with the
operator's own framing of it as a shared, cross-cutting gap.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9

 Test Files  63 passed (63)
      Tests  610 passed (610)
```

(The one lint warning is pre-existing in `src/components/ui/button.tsx`,
shadcn-generated, untouched by this diff.)

## What was deliberately not changed, and why

- Finding 4 (hardcoded `es` locale in the custom-range chip label) — see
  above; the operator's own in-flight cross-cutting pass should cover it
  alongside `MovimientoRow`'s other call sites, not a one-off fix here.
- Everything else in `src/features/search/**` not called out above was
  read and left as-is: `useDebouncedQuery`, `searchMatch`,
  `useSearchFilters`, `searchCopy`, and `FilterSheet` all matched their
  brief, their own tests, and the project's error-handling/testing/UI
  rules with nothing to flag.

## For the operator

- Finding 4 needs no separate action — Track M's brief (already on `main`
  as of this review's second rebase) independently names
  `SearchScreen.tsx` in its inventory.
- Process note: this worktree was briefed as "already rebased on current
  `main`," which was true when the review started but went stale mid-review
  — twice. `main` gained real commits (the locale-formatting hook, then the
  Track M brief, then Track E2's own review merge) while this review was in
  flight. Rebased twice before finishing (both clean, no conflicts) per
  `AGENTS.md`'s own "rebase before finishing" rule. Not a defect in this
  track, just worth naming: a review dispatched while several other tracks
  are actively merging is racing a moving `main`, and "already rebased" in
  a brief can go stale before — or during — the reviewer's own run. Worth
  considering whether review dispatches should serialize against
  in-flight merges, or whether reviewers should just be told to expect and
  handle this (as done here) rather than treat one rebase as sufficient.
