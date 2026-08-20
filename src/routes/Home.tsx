import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePendingDelay } from '@/components/shared'
import { AreasBanner } from '@/features/home/AreasBanner'
import { BalanceCard } from '@/features/home/BalanceCard'
import { HomeEmptyState } from '@/features/home/HomeEmptyState'
import { HomeErrorState } from '@/features/home/HomeErrorState'
import { HomeHeader } from '@/features/home/HomeHeader'
import { HomeLoadingState } from '@/features/home/HomeLoadingState'
import { RecentMovimientos } from '@/features/home/RecentMovimientos'
import { WeekStrip } from '@/features/home/WeekStrip'
import { WeeklyChart } from '@/features/home/WeeklyChart'
import { useHomeDashboard } from '@/features/home/useHomeDashboard'

// The dashboard: greeting/bell chrome and search entry render regardless of
// data status; the money-dependent content below switches on
// loading/error/empty/ready (docs/wave-2-plan.md §4, Track E2 "Done when").
// The screen's <h1> lives inside HomeHeader (the greeting) — the design's
// actual subject for this screen, not the app name.
export const Home = () => {
  const { t } = useTranslation('home')
  const dashboard = useHomeDashboard()
  const isPending = dashboard.status === 'idle' || dashboard.status === 'loading'
  // Anti-flash gate (specs.md §10.9): a first load fast enough to beat the
  // delay shows nothing at all, and a skeleton that did appear never blinks
  // back out before its minimum-visible time.
  const showLoading = usePendingDelay(isPending)

  return (
    <main className="min-h-full px-5 pt-2 pb-1">
      <HomeHeader />
      <Link
        to="/search"
        className="mb-4.5 flex h-11.5 items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 text-fg-tertiary"
      >
        <Search className="size-4.5" aria-hidden="true" />
        <span className="text-sm font-medium">{t('searchPlaceholder')}</span>
      </Link>

      {showLoading ? (
        <HomeLoadingState />
      ) : dashboard.status === 'error' && dashboard.error ? (
        <HomeErrorState code={dashboard.error} onRetry={dashboard.retry} />
      ) : isPending ? null : dashboard.isEmpty ? (
        <HomeEmptyState />
      ) : (
        <div className="flex flex-col gap-4.5">
          <div className="rounded-4xl border border-border-subtle bg-card p-3.5">
            <WeekStrip monthLabel={dashboard.monthLabel} days={dashboard.weekStripDays} />
            <BalanceCard totals={dashboard.totals} moneda={dashboard.moneda} />
          </div>
          <WeeklyChart
            chart={dashboard.week.chart}
            totalGastos={dashboard.week.totalGastos}
            moneda={dashboard.moneda}
            todayIso={dashboard.todayIso}
          />
          <AreasBanner />
          <RecentMovimientos movimientos={dashboard.recent} categorias={dashboard.categorias} />
        </div>
      )}
    </main>
  )
}
