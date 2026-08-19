# src/features/home

The `/` dashboard's content (`src/routes/Home.tsx` composes these; the
persistent nav/shell around it is `src/routes/AppShell.tsx`, owned by
Track L).

- `useHomeDashboard.ts` — the only place Home reads data. Subscribes to
  `src/lib/dataStore.ts`, triggers `load()` on mount, and derives every
  figure through `src/lib/movimientoStats.ts`'s pure functions (never a
  local sum/aggregation). Returns render-ready data plus `status`/`error`/
  `retry` for the three non-happy states.
- `homeView.ts` — pure, data-free presentation helpers: greeting bucket
  (morning/afternoon/evening), initials from a display name, weekday
  labels, and the week-strip's 7-day scaffold (which days have a real
  movement — membership only, not a total). `shortDayLabel`/
  `narrowDayLabel`/`monthYearLabel`/`buildWeekStripDays` take a required
  `Locale` parameter (no default) — `useHomeDashboard.ts` supplies it via
  `useLocaleFormatting()` (`docs/wave-2/track-m.md`).
- `errorCopy.ts` — `RepoErrorCode` → translation key, exhaustive over the
  closed union (a missing case is a compile error, no drift-guard test
  needed, unlike the message-keyed auth/lock copy tables).
- `usePrefersReducedMotion.ts` — `matchMedia` via `useSyncExternalStore`,
  degrading to `false` when `matchMedia` is unavailable (jsdom in tests).
  Gates the weekly chart's recharts animation; every CSS transition
  already respects reduced motion globally via `src/styles/index.css`.
- `HomeHeader.tsx` — greeting + real Google profile name (`authStore.user`)
  - the notifications bell, rendered `disabled` (`// STUB(wave3)`, no
    unread dot — there is no notification source to back one).
- `WeekStrip.tsx` — read-only current-week overview (no prev/next, no
  day-tap; see `docs/wave-2/track-e2.md` for why).
- `BalanceCard.tsx` — all-time balance (not period-scoped — matches the
  design), hide/show toggle (local state, not persisted), income/expense
  mini-stats. Calls `useLocaleFormatting()` directly for `formatMonto`.
- `WeeklyChart.tsx` — recharts bar chart of the current week's daily
  `gastos`, from a single `series(...)` call. Calls `useLocaleFormatting()`
  directly for `formatMonto`/day labels.
- `AreasBanner.tsx` — `// STUB(trackH)`, rendered `disabled` and dimmed
  like `BottomNav`'s own stub slots, not a full-color dead link.
- `RecentMovimientos.tsx` — most recent movements via the shared
  `MovimientoRow`, "Ver todo" linking to `/history`. Calls
  `useLocaleFormatting()` directly and forwards `locale`/`dateFnsLocale`
  to each `MovimientoRow`.
- `HomeLoadingState.tsx` / `HomeEmptyState.tsx` / `HomeErrorState.tsx` —
  the three non-happy states `Home.tsx` switches on; the error state's
  retry button calls `useHomeDashboard`'s `retry` (re-invokes
  `dataStore.load()`).

See `docs/wave-2/track-e2.md` for the decisions behind the choices above
(why "Áreas" is `disabled` and not just non-interactive, why the balance
figure is all-time, the existing-token substitutions for colors the
design used that had no token, and an open question for the operator
about Track E4's month-total cross-check).
