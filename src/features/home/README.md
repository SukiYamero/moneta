# src/features/home

The `/` dashboard's content (`src/routes/Home.tsx` composes these; the
persistent nav/shell around it is `src/routes/AppShell.tsx`).

- `useHomeDashboard.ts` — the only place Home reads data. Subscribes to
  `src/lib/dataStore.ts`, triggers `load()` on mount, and derives every
  figure through `src/lib/movimientoStats.ts`'s pure functions, scoped to
  `Config.preferencias.monedaPrincipal`. Also returns `otherCurrencies`,
  `status`/`error`/`retry`, and `categorias` for resolving movement
  category ids.
- `homeView.ts` — pure, data-free presentation helpers: greeting bucket
  (morning/afternoon/evening), weekday labels, and the week-strip's 7-day
  scaffold.
- `usePrefersReducedMotion.ts` — `matchMedia` via `useSyncExternalStore`,
  degrading to `false` when unavailable. Gates the weekly chart's recharts
  animation.
- `HomeHeader.tsx` — greeting + Google profile name (`authStore.user`), or a
  guest label when `authStore.status === 'guest'`.
- `WeekStrip.tsx` — read-only current-week overview.
- `BalanceCard.tsx` — all-time balance, a local (unpersisted) hide/show
  toggle, and income/expense mini-stats.
- `WeeklyChart.tsx` — recharts bar chart of the current week's daily gastos.
- `AreasBanner.tsx` — disabled, dimmed stub slot.
- `RecentMovimientos.tsx` — most recent movements via the shared
  `MovimientoRow`, "Ver todo" linking to `/history`; row taps open the
  movement sheet via `useMovimientoSheetStore().openMovimiento(id)`.
- `HomeLoadingState.tsx` / `HomeEmptyState.tsx` / `HomeErrorState.tsx` — the
  three non-happy states `Home.tsx` switches on. The error state's retry
  calls `useHomeDashboard`'s `retry`; `HomeLoadingState` is built on the
  shared `Skeleton`/`SkeletonGroup` primitives, gated behind
  `usePendingDelay`.
