import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePendingDelay } from '@/components/shared'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
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

export const Home = () => {
  const { t } = useTranslation(['home', 'common'])
  const { locale } = useLocaleFormatting()
  const dashboard = useHomeDashboard()
  const isPending = dashboard.status === 'idle' || dashboard.status === 'loading'
  const showLoading = usePendingDelay(isPending)
  const otherCurrenciesLabel =
    dashboard.otherCurrencies.length > 0
      ? new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(
          dashboard.otherCurrencies,
        )
      : null

  return (
    <main className="min-h-full px-5 pt-(--screen-inset-top) pb-1">
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
          {otherCurrenciesLabel && (
            <p className="-mt-2 px-1 text-sm font-medium text-fg-tertiary">
              {t('common:otherCurrencyNote', { currencies: otherCurrenciesLabel })}
            </p>
          )}
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
