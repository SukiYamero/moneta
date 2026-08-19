# Review — Wave 2.2 · Track P (loading system)

Reviewing `a023e13` (`Skeleton.tsx`, `ScreenLoading.tsx`, `usePendingDelay.ts`,
the three screens' loading states, `HistoryScreen.tsx`'s restructure,
`router.tsx`, `KitLazy.tsx`, `Kit.tsx`, locale files), rebased onto `main`
(`99af75a` — Track P's own merge plus Track Q's review and a follow-up
specs.md clarification, all already in). Rigor: high — a timing hook with
two competing timers gates every loading state in the app.

## Done-when verification (run, not read)

specs.md §10.9's "Done when" line, checked item by item:

- **Boot no longer flashes the login screen** — Track Q's concern
  (`RequireAuth.tsx`), verified by that track's own review
  (`docs/wave-2.2/review-q.md`, finding 1). Out of this track's files;
  not re-verified here beyond confirming the `SEAM(track-p)` placeholder
  is still exactly what Track P's report describes.
- **The three screens share one skeleton primitive and one loading
  treatment** — confirmed by reading `HomeLoadingState.tsx`,
  `SearchLoadingState.tsx`, `HistoryLoadingState.tsx`: each composes
  `Skeleton`/`SkeletonGroup` from `src/components/shared/Skeleton.tsx`,
  nothing hand-rolled.
- **A fast load shows no loader at all** — verified two ways: (1) unit
  tests on `usePendingDelay` itself with fake timers (existing 9 +
  4 added, below); (2) at the screen level, `Home.test.tsx`,
  `SearchScreen.test.tsx`, `HistoryScreen.status.test.tsx` each assert
  `queryByRole('status')` is absent immediately after mount while
  `status` is `idle`/`loading`, ran and passing.
- **`bun run check` green** — see bottom of this file.

## Findings

### 1. `usePendingDelay` — no defect found; hardened with 4 new tests, one confirmed by mutation

Traced every scenario in the brief by hand, then wrote a test for each and
ran it. All pass against the real implementation:

- **Rapid `isPending` flapping (retry loop), before and after the loader
  shows** — never double-shows, never leaks a timer
  (`vi.getTimerCount()` is `0` once everything settles). The mechanism:
  `useEffect`'s own cleanup always runs before the next dep-triggered
  invocation, so there is only ever one live `setTimeout` at a time; the
  `if (show) return` / `if (!show) return` early-outs mean a re-render
  triggered by `show` itself (via the show-timer's own `setShow(true)`)
  never re-arms a second timer.
- **Unmount mid-timer** — tested both timers separately: mid-show-timer
  (already existed) and, newly, mid-**hide**-timer (pending resolves,
  `show` is `true`, unmount before the 350ms minimum-visible window
  elapses). Neither leaks a `setState` after unmount — asserted via a
  `console.error` spy staying uncalled, not just "doesn't throw."
- **`isPending` clearing exactly at the delay boundary** — already
  covered by the existing 149ms-false/150ms-true pair; no gap.
- **`delayMs`/`minVisibleMs` changing mid-flight** — real behavior,
  documented by a new test: a value change while the show-timer is still
  pending clears it and starts a fresh full-length timer under the new
  value from that instant — it does **not** credit time already elapsed
  under the old value. This only matters if a caller ever passes a
  non-constant `delayMs`/`minVisibleMs`; none of the three real call
  sites do (`usePendingDelay(isPending)`, no options object), so this is
  PLAUSIBLE-but-inert today, not a live bug. Flagging in case a future
  caller ties the delay to something dynamic.
- **`remaining === 0` scheduling `setTimeout(…, 0)`** — harmless; already
  exercised by the existing "hides immediately" test. It defers the hide
  by one macrotask instead of hiding synchronously, which is a one-tick
  cosmetic detail, not a bug (React state updates from an effect are
  already async relative to the triggering render).

**Verified the new tests actually test something**: temporarily deleted
the show-timer's cleanup (`return () => clearTimeout(timer)` →
`return undefined`) and reran — 4 tests failed for the right reason
(stale timer firing after a dep change), including 2 of the new ones.
Restored, all 12 pass again.

### 2. CONFIRMED (reproduced with a test) — `HistoryScreen`'s `semana`-scope chrome can render the `CONFIG_SEMILLA` default, then visibly change once real config loads

Traced, then reproduced with a new test
(`HistoryScreen.status.test.tsx`, "recomputes the semana header once
config resolves with a different `primerDiaSemana`..."). Mechanism:

- `periodRange`/`buildWeekOptions` (`movimientoStats.ts`,
  `historyPeriodOptions.ts`) only consume `primerDiaSemana` for the
  `semana` scope — `dia`, `mes`, and `anio` never touch it. Default
  scope on mount is `dia` (`useHistoryPeriod.ts`), so **this only
  manifests if the user switches to the "Semana" tab during the load
  window**, not on a stock cold boot.
- When they do, the always-mounted header (`getPeriodLabel`) and picker
  strip render against `(config ?? CONFIG_SEMILLA).preferencias`
  (`HistoryScreen.tsx:55`) — a real, visible date range, not a skeleton.
  Once `config` resolves with a different `primerDiaSemana`, that range
  recomputes and the header/picker text changes with no further user
  action. The test proves this by switching to `semana` while
  `config: null`, asserting the seed-default (`weekStartsOn: 1`) range
  renders, then resolving `config` with `primerDiaSemana: 0` and
  asserting the header now shows the Sunday-start range instead.
- **Currently unreachable in production**, which matters for severity:
  grepped for every write path to `Preferencias.primerDiaSemana` — there
  is none. `seedConfig.ts`'s `buildSeedConfig()` spreads
  `CONFIG_SEMILLA.preferencias` and only overrides `monedaPrincipal` per
  region; `primerDiaSemana` is never anything but `1` for any real user
  today. So the flip this test demonstrates is real and will fire the
  day a preferences screen lets a user pick a different week start, but
  it cannot happen with the app as it ships.

**Not fixed — asking for a call.** The three shapes I see, none obviously
right without a product decision:

1. Leave as-is, accepted as a known latent gap to close when
   `primerDiaSemana` becomes user-editable (cheapest, but silent until
   then — the same "regression latent until a feature ships" shape
   AGENTS.md's "fix the shape, not the instance" note warns about).
2. Gate only the `semana`-scope header/picker behind `isPending`,
   leaving `dia`/`mes`/`anio` and the nav buttons/scope tabs mounted —
   reintroduces a partial "chrome disappears" for exactly one scope,
   which is the thing this whole restructure was built to remove.
3. Derive the pre-load default from the active locale (date-fns/`Intl`
   week-info) instead of `CONFIG_SEMILLA`'s hardcoded Monday — closer
   to "probably right" but still not guaranteed to match the user's
   actual saved preference, and adds a second source of "what's the
   default" that could drift from `CONFIG_SEMILLA` itself.

### 3. Router `/kit` lazy route — confirmed end-to-end with two new integration tests

`src/router.kit.test.tsx` (real, unmocked dynamic import): navigating to
`/kit` renders the `Suspense` fallback path and resolves to the real
`Kit` content (`findByRole('heading', { name: 'Shared UI kit' })`).
`src/router.kitError.test.tsx` (mocks `@/routes/Kit` to throw at import
time, in its own file so the mock can't leak into the success-path test):
navigating to `/kit` still renders `RouteErrorFallback`
(`role="alert"`, "tuvo un problema inesperado") rather than a blank
screen or a hang — the route's own `errorElement` does catch a lazy
chunk failure, same as it always caught a render/loader throw. The three
eager routes (`/`, `/search`, `/history`) are untouched in the diff —
confirmed by reading `router.tsx`'s diff, no behavior change there.

### 4. Accessibility — no duplication, no loss

Read `Skeleton.tsx`/`SkeletonGroup` and all three loading-state diffs.
Exactly one `SkeletonGroup` per screen (one `aria-busy` container, one
`sr-only role="status"`), decoration blocks are `Skeleton` (`aria-hidden`
each). `HomeLoadingState`'s pre-existing hand-rolled version had the same
shape 1:1 — a faithful refactor, not a behavior change. Search/History's
old bare `<p role="status">`/plain-text loaders are fully removed, not
left alongside the new one (confirmed via `git show a023e13` diff — no
leftover node). Error paths keep their own separate `role="alert"`,
verified still passing (`HistoryScreen.status.test.tsx`'s "does not
render `role=status` alongside `role=alert`" case).

### 5. `prefers-reduced-motion` — respected, nothing bypasses it

`src/styles/index.css`'s `@media (prefers-reduced-motion: reduce)` block
targets the universal selector (`*, *::before, *::after`), zeroing
`animation-duration`/`animation-iteration-count`/`transition-duration`
project-wide — not scoped to specific utility classes. Both `Skeleton`'s
`animate-pulse` and `ScreenLoading`'s `Loader2 animate-spin` are
Tailwind CSS-animation utilities, so both are already covered; nothing in
this diff sets an inline `animation`/`transition` style that could
sidestep the global rule.

### 6. Timing numbers (150ms / 350ms) — defensible, left unchanged

specs.md §10.9 names these numbers itself ("~150ms"/"~350ms") as the
tunable-when-building baseline, not as a placeholder to derive from
scratch. They sit in the range this class of anti-flash pattern commonly
uses elsewhere (short show-delay in the low hundreds of ms, a
minimum-visible a bit more than double that so a shown loader reads as
intentional rather than a flicker). Track P's own report is honest that
the fake repo resolves sub-millisecond, so nothing in this codebase's
test suite — including this review's — exercises them against real
latency; that is Wave 3 (real network-backed repo) territory, not a gap
in this diff. No reason surfaced here to change them.

## Sweep — "fix the shape, not the instance"

Grepped for the same shapes the brief called out, beyond the six items
above:

- **Every other `CONFIG_SEMILLA.preferencias` fallback in `src/features`**
  (`useHomeDashboard.ts`'s `primerDiaSemana`/`moneda`,
  `SearchScreen.tsx`'s `categories`/`primerDiaSemana`): all either (a)
  computed but never rendered until `status === 'ready'` (Home — the
  whole week-strip/balance/chart block is behind the same
  `isPending ? null : ...` branch its computation feeds), or (b) gated
  behind a control that's `disabled={!ready}` (Search's filter button —
  `FilterSheet`, the only consumer of the `primerDiaSemana` fallback
  there, cannot be opened before `ready`). History is the only place
  where a `CONFIG_SEMILLA` fallback feeds something rendered
  unconditionally — matches the operator's own suspicion that this was
  "the single most likely place for a real bug in this diff."
- **`YearMenu`'s options** (`buildYearOptions(movimientos, new Date())`)
  also change once real data loads (starts as `[currentYear]`, grows as
  movimientos with other years arrive) — not the same defect shape,
  though: it's an honest "no data yet" state growing as real data
  streams in, not a fabricated default standing in for a real value.
  Noting it, not flagging it.
- **Every other `role="status"`/`animate-pulse`/`animate-spin`/`Loader2`/
  `isLoading` site outside this diff** (`DrivePermissionScreen.tsx`'s
  overlay, `RequireAuth.tsx`'s `BootScreen`): both already tracked,
  neither produced a new consequence beyond what's already logged for
  them.

Nothing else found.

## What I left and why

- Finding 2 (`HistoryScreen`'s `semana`-scope seed-default flip) — not
  fixed; see the three options above and the operator's call requested.
- `DrivePermissionScreen.tsx`'s full-screen overlay and `RequireAuth.tsx`'s
  `BootScreen` seam — untouched, per the brief (Track Q's files, already
  tracked, no new consequence found).
- 150ms/350ms — left as-is; no evidence surfaced to change them (finding 6).

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  74 passed (74)
      Tests  699 passed (699)
```

Run after rebasing onto `main` (`99af75a` — Track Q's review plus a
follow-up specs.md clarification, both already in). The oxlint warning is
the same pre-existing shadcn-generated `src/components/ui/button.tsx`
warning both Track P's and Track Q's reports also note — untouched here.
Up from Track P's reported 690: this review adds 4 `usePendingDelay`
tests, 1 `HistoryScreen` reproduction test, and 2 router tests (7 total)
on top of Track Q's own review already merged to `main` before this
branch existed.
