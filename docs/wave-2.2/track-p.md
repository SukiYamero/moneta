# Track P — report

## Decisions made (for specs.md §11)

- **Two shared primitives, not one.** `Skeleton` (a single decorative block,
  shaped per-call via `className`) and `SkeletonGroup` (the accessible
  wrapper: `aria-busy`, one `sr-only role="status"` announcement) are two
  small exports from one file (`src/components/shared/Skeleton.tsx`) rather
  than a single monolithic component. Each screen's loading state composes
  `Skeleton` blocks inside one `SkeletonGroup` to match its own layout — the
  primitive is the shape `HomeLoadingState` used to hand-roll; the group is
  the accessibility contract every tier shares. `HomeLoadingState` itself
  was refactored onto both, not just left as the reference — otherwise
  "share the primitive" would mean two mechanisms (Home's old markup, and
  Search/History's new one) doing the identical thing.

- **`usePendingDelay`'s hide timer is driven by `shownAt` (a timestamp),
  not a second fixed timer.** When `isPending` clears, the remaining
  minimum-visible time is `minVisibleMs - (Date.now() - shownAt)`, clamped
  to 0. This makes "hides immediately once already outlasting the minimum"
  fall out of the same code path as "keeps showing for the remainder" —
  no separate branch needed, and no risk of an already-long-visible loader
  tacking on a pointless extra 350ms after the work is done. Verified in
  `usePendingDelay.test.ts`.

- **The gate is a boolean-in/boolean-out hook (`usePendingDelay(isPending,
opts?)`), not a component.** Each screen already owns its own `status`
  read (`dataStore`); wrapping that in a hook composes with the existing
  ternary/branch structure instead of introducing a second way to decide
  what renders. `delayMs`/`minVisibleMs` default to 150/350 (both tunable
  per call site, though nothing needed to tune them here).

- **History's chrome (period nav, scope tabs, picker strip) now renders
  unconditionally**, defaulting to `CONFIG_SEMILLA.preferencias` when
  `config` is still `null` — the same fallback pattern Home/Search already
  use for `moneda`/`primerDiaSemana`. Previously the whole screen (including
  the `<h1>`-adjacent header) was replaced by a bare loading/error line
  behind an early `if (status !== 'ready' || !config) return ...`. Only the
  breakdown card + movements list region (the actual data-dependent content)
  now switches between skeleton / error / empty / real content — matching
  the brief's "chrome stays put, only the content region fills in" for
  Search's already-correct structure, and closing the gap History had that
  Home/Search didn't.

- **`ScreenLoading` takes one optional `className` prop (default
  `min-h-dvh`), not zero.** The brief asked for a prop-less drop-in for
  `RequireAuth` — satisfied, since omitting `className` reproduces the
  exact original API. The one prop exists solely so `/kit`'s gallery can
  preview it at a bounded height (`min-h-72` overrides `min-h-dvh` via
  `cn()`/`tailwind-merge`'s conflict resolution) instead of rendering a
  full-viewport block inline in the dev page. `RequireAuth` would call it
  with zero arguments.

- **`/kit`'s lazy route is now `React.lazy` + `<Suspense>`, not
  react-router's own route-level `lazy` field.** Route-level `lazy` has no
  fallback slot of its own — the module fetch blocks the navigation with
  nothing rendered, not a Suspense-driven fallback, which is what the brief
  asked to wire. Isolated the lazy wrapper into its own file
  (`src/routes/KitLazy.tsx`) rather than declaring it inline in
  `router.tsx`: a capitalized, JSX-used binding living alongside
  `router.tsx`'s own non-component `router` export tripped
  `react/only-export-components` (verified: the warning appeared only after
  adding the inline `const Kit = lazy(...)`, confirmed by diffing lint
  output with/without the change). The split is also just tidier — a file
  that exports one lazy-wrapped component, nothing else.

- **Added one key, `common.loading`, to all four locale files** (the
  `common` namespace was empty in every one) for `ScreenLoading`'s own
  copy, keeping `resources.test.ts`'s key-parity check green
  (es "Cargando…" / en "Loading…" / es-AR "Cargando…" / pt-BR
  "Carregando…").

## Backlog / deferred (for specs.md §12)

- **`DrivePermissionScreen.tsx`'s `connecting` state is a full-screen
  absolute overlay** (`bg-background/75` + `Loader2 animate-spin`,
  lines ~86–91) while `connectDrive()` is in flight — this is exactly the
  Tier 3 anti-pattern specs.md §10.9 names ("never a full-screen overlay,
  never a blocking modal"; the busy state belongs on the control that was
  pressed, the way `WelcomeScreen`'s own Google button already does the
  label swap). **Not fixed here** — `src/features/auth/**` is Track Q's
  file ownership, off-limits to this track. Flagging it as a real,
  pre-existing Tier 3 violation for whoever next touches that screen.
- **`RequireAuth.tsx`'s `BootScreen` is a placeholder Track Q left for this
  exact merge**, marked `// SEAM(track-p): stand-in for the shared
ScreenLoading component ... deliberately minimal so it's a one-line swap
once that merges.` Per this track's brief, `RequireAuth.tsx` is not
  touched here. The swap once both branches are on `main`: delete the local
  `BootScreen` function and its `t('boot.loading')` sr-only string, replace
  `<BootScreen />` with `<ScreenLoading />` (`import { ScreenLoading } from
'@/components/shared'`), and drop the now-unused `auth:boot.loading` key
  from all four locale files (or fold it into `common.loading`, which now
  says the same thing).

## Doc lines to add

I do not own any of these READMEs — handing over the lines rather than
editing them, per the track brief.

- `src/components/shared/README.md`, appended after the `Toaster.tsx`
  bullet and before the `index.ts` bullet:

  > - `Skeleton.tsx` — `Skeleton` (a single `aria-hidden` decorative block,
  >   shaped per call via `className`) and `SkeletonGroup` (the accessible
  >   wrapper every loading tier shares: `aria-busy` on the container, one
  >   `sr-only role="status"` announcement — not one per block). Home,
  >   Search and History's loading states (`HomeLoadingState.tsx`,
  >   `SearchLoadingState.tsx`, `HistoryLoadingState.tsx`) all compose these
  >   two rather than hand-rolling skeleton markup.
  > - `ScreenLoading.tsx` — Tier 1 (specs.md §10.9): full-screen,
  >   brand-consistent loading for boot and lazy-route `Suspense`
  >   fallbacks — never a tab change, which has no data wait
  >   (`dataStore.load()` is once-per-session). No props required for its
  >   real callers; the one optional `className` exists only so `/kit`'s
  >   gallery can preview it at a bounded height. Used as the `/kit` lazy
  >   route's `Suspense` fallback (`router.tsx`); `RequireAuth.tsx`'s own
  >   `BootScreen` placeholder is a Track Q seam meant to be swapped for
  >   this component once both merge (see `docs/wave-2.2/track-p.md`).
  > - `usePendingDelay.ts` — the two-sided anti-flash gate every loading
  >   tier shares (specs.md §10.9): don't show a loader until the work has
  >   been pending ~150ms, and once shown keep it visible ~350ms minimum.
  >   A boolean-in/boolean-out hook (`usePendingDelay(isPending, opts?)`),
  >   not a component — each screen wraps its own `status` read in it.

- `src/features/home/README.md`, in the `HomeLoadingState.tsx` bullet — add:
  "now built on the shared `Skeleton`/`SkeletonGroup` primitives
  (`src/components/shared/Skeleton.tsx`) rather than hand-rolled markup;
  `Home.tsx` gates it behind `usePendingDelay` so a fast load shows nothing
  at all."

- `src/features/search/README.md`, in the `SearchScreen.tsx` bullet — add:
  "Its loading state is `SearchLoadingState.tsx` (skeleton rows over the
  results region only — the title/search input/filter button stay mounted
  regardless of status), gated behind `usePendingDelay` the same way Home
  is, replacing the old plain-text loading label."

- `src/features/history/README.md`, in the `HistoryScreen.tsx` bullet —
  replace "reads through `useDataStore`..." paragraph's implicit
  all-or-nothing rendering with: "The period nav, scope tabs and picker
  strip render unconditionally (defaulting to `CONFIG_SEMILLA.preferencias`
  before `config` loads, the same fallback Home/Search use) — only the
  breakdown card + movements list region switches between
  `HistoryLoadingState` (skeleton, gated behind `usePendingDelay`), the
  inline error, the period-empty state, and the real content. This replaced
  an earlier full-screen early-return that swapped out the header too."

## Spec deltas

None. §10.9 as written matches what was built — see "Open questions" below
for the one place I think it's worth a closer look, not a contradiction.

## Open questions for the operator

1. **The `DrivePermissionScreen` full-screen overlay (Backlog, above) is a
   real, pre-existing Tier 3 violation, CONFIRMED by reading the code
   (`src/features/auth/DrivePermissionScreen.tsx` lines ~86–91: `<div
className="absolute inset-0 z-10 ... bg-background/75">` wrapping
   `Loader2 animate-spin` + text, shown while `connecting` is true).** Worth
   a decision on whether it's in scope for someone to fix now, or tracked
   for later — it predates this track and isn't in a file I own.
2. **150ms/350ms are the numbers named in specs.md §10.9 itself** ("do not
   show a loader until the work has been pending ~150ms... keep it for
   ~350ms"), so I used them as given rather than independently deriving a
   different pair — the brief already treated them as reasonable defaults
   to tune "when building," and nothing in this codebase's actual load
   times (the fake repo resolves in well under a millisecond) gave a signal
   to tune away from them. Flagging that they're untested against a real
   network-backed repo (Wave 3), since that's the only scenario where the
   gate will ever visibly matter in production.

## Tests watched fail before implementing (TDD)

- `src/components/shared/usePendingDelay.test.ts` — all 9 cases, written
  first: failed with `Failed to resolve import
"@/components/shared/usePendingDelay"` (module didn't exist yet) before
  `usePendingDelay.ts` was added. Ran again after implementing: all 9 pass,
  including the two-sided delay/minimum-visible rule, the "resumes without
  a new delay while still within the minimum-visible window" case, the
  never-shows-on-flicker case, and the unmount-clears-timers case.
- `src/routes/Home.test.tsx`, `src/features/search/SearchScreen.test.tsx`,
  `src/features/history/HistoryScreen.status.test.tsx` — the three
  pre-existing "shows a loading state" tests asserted a `role="status"`
  node **synchronously immediately after `render()`**, which is exactly the
  flash the anti-flash gate exists to remove. Watched each fail after
  wiring `usePendingDelay` into the screen (loader no longer appears
  instantly), for the intended reason, then rewrote each into an
  immediate-shows-nothing case plus a fake-timer-advanced-150ms
  shows-loading case. Both now pass in all three files.

## Sweep — "fix the shape, not the instance"

Grepped `src/` for `role="status"`, `animate-pulse`, `animate-spin`,
`Loader2`, `isLoading`, and `status === 'loading'` (excluding tests). Found,
beyond the three screens this track rebuilt:

- `src/features/auth/DrivePermissionScreen.tsx` — the full-screen overlay
  above (Backlog). Not this track's file to fix.
- `src/features/auth/RequireAuth.tsx` — the `BootScreen` seam Track Q left
  for this exact merge (Backlog). Not this track's file to touch.
- `src/features/auth/WelcomeScreen.tsx` — its Google button's busy label
  swap. Already the correct Tier 3 pattern per specs.md §10.9 itself
  ("`WelcomeScreen`'s Google button already does the label swap; that is
  the pattern") — nothing to change.
- `src/features/lock/**` — grepped separately for `Cargando`/`busy`/
  `pending`/`spinner`: no hits. The lock feature has no loading treatment
  to unify (PIN entry/biometric checks are local, not network-bound).

Nothing else in `src/` renders a loading treatment outside what's listed
above and what this track rebuilt.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  72 passed (72)
      Tests  690 passed (690)
```

The single oxlint warning is the same pre-existing shadcn-generated
`src/components/ui/button.tsx` warning Track Q's report also notes —
untouched by this track.

Also ran `bun run build`: succeeds, and `/kit`'s lazy chunk shows up as its
own file in the output (`dist/assets/Kit-*.js`, ~17.5kB), confirming the
`React.lazy`/`Suspense` wiring actually produces a real code-split boundary
with something to wait for, not a no-op.

Ran after rebasing onto `main` (`b1197a0`, Track Q's merge already in),
`git diff main..HEAD --stat` shows exactly the 21 files this track touched
— same green result, 690/690 (up from 683 pre-rebase — the difference is
Track Q's own tests, already on `main`).
