import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CONFIG_SEMILLA, type Periodo, type TipoMovimiento } from '@/lib/schema'
import { breakdownBy, filterByRange, periodRange, totals } from '@/lib/movimientoStats'
import { useDataStore } from '@/lib/dataStore'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import {
  InlineErrorState,
  MovimientoRow,
  SegmentedControl,
  usePendingDelay,
  type SegmentedControlOption,
} from '@/components/shared'
import { useHistoryPeriod } from '@/features/history/useHistoryPeriod'
import {
  buildDayOptions,
  buildMonthOptions,
  buildWeekOptions,
  buildYearOptions,
  PICKER_FOR_SCOPE,
} from '@/features/history/historyPeriodOptions'
import { getPeriodLabel } from '@/features/history/historyPeriodLabel'
import { PeriodPickerRow } from '@/features/history/PeriodPickerRow'
import { YearMenu } from '@/features/history/YearMenu'
import { BreakdownCard } from '@/features/history/BreakdownCard'
import { HistoryLoadingState } from '@/features/history/HistoryLoadingState'

const SCOPES: Periodo[] = ['dia', 'semana', 'mes', 'anio']

// Named export `HistoryScreen`, no props: the stable contract this route
// renders against (src/router.tsx). Enter animation kept from the L
// placeholder — History is a push (a sibling tab), Search is a fade
// (AGENTS.md § UI, docs/wave-2/track-e4.md).
export const HistoryScreen = () => {
  const { t } = useTranslation('history')
  const { movimientos, config, status, error, load } = useDataStore()
  const { scope, anchor, setScope, selectAnchor, step, selectYear } = useHistoryPeriod()
  const [bdType, setBdType] = useState<TipoMovimiento>('gasto')
  const { locale, dateFnsLocale } = useLocaleFormatting()

  useEffect(() => {
    void load()
  }, [load])

  const isPending = status === 'idle' || status === 'loading'
  // Anti-flash gate (specs.md §10.9), same rule Home/Search share.
  const showLoading = usePendingDelay(isPending)

  // The period nav, scope tabs and picker strip are pure functions of
  // scope/anchor/movimientos — they need no more than CONFIG_SEMILLA's
  // defaults to render correctly before the real config loads (same
  // fallback Home/Search already use), so this chrome stays mounted
  // through every status instead of disappearing behind a full-screen
  // loading swap the way it used to.
  const { primerDiaSemana, monedaPrincipal } = (config ?? CONFIG_SEMILLA).preferencias
  const range = periodRange(scope, anchor, primerDiaSemana)
  const periodMovimientos = filterByRange(movimientos, range)
  const periodTotals = totals(periodMovimientos)
  const breakdown = breakdownBy(periodMovimientos, 'categoria', bdType)
  const years = buildYearOptions(movimientos, new Date())
  const label = getPeriodLabel(
    scope,
    range,
    new Date(),
    {
      today: t('today'),
      week: t('weekLabel'),
      summary: t('summary'),
    },
    dateFnsLocale,
  )

  const scopeOptions: SegmentedControlOption<Periodo>[] = SCOPES.map((value) => ({
    value,
    label: t(`scope.${value}`),
  }))

  const pickerKind = PICKER_FOR_SCOPE[scope]

  return (
    <main className="flex min-h-full animate-push-in flex-col pt-14">
      <h1 className="sr-only">{t('title')}</h1>

      <div className="flex items-center gap-2.5 px-5 pb-3.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={t('nav.previous')}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-xl font-extrabold tracking-tight capitalize">
            {label.title}
          </div>
          <div className="truncate text-xs font-medium text-fg-tertiary capitalize">
            {label.subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={t('nav.next')}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
        <YearMenu
          years={years}
          selectedYear={Number(range.from.slice(0, 4))}
          onSelect={selectYear}
        />
      </div>

      <div className="px-5 pb-3">
        <SegmentedControl
          options={scopeOptions}
          value={scope}
          onChange={setScope}
          aria-label={t('scope.ariaLabel')}
        />
      </div>

      {pickerKind !== 'none' && (
        <div className="px-5 pb-3">
          <PeriodPickerRow
            aria-label={t(`scope.${scope}`)}
            onSelect={selectAnchor}
            options={
              pickerKind === 'day'
                ? buildDayOptions(movimientos, anchor, range, dateFnsLocale)
                : pickerKind === 'week'
                  ? buildWeekOptions(movimientos, anchor, range, primerDiaSemana, dateFnsLocale)
                  : buildMonthOptions(movimientos, anchor, range, primerDiaSemana, dateFnsLocale)
            }
          />
        </div>
      )}

      <div className="flex-1 px-5 pt-1">
        {showLoading ? (
          <HistoryLoadingState />
        ) : status === 'error' ? (
          <InlineErrorState
            message={t(repoErrorCopyKey(error ?? 'unknown'))}
            retryLabel={t('retry')}
            onRetry={() => void load()}
          />
        ) : isPending ? null : periodMovimientos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <SearchIcon className="size-9 text-fg-disabled" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-fg-tertiary">{t('empty.title')}</p>
              <p className="mt-1 text-xs font-medium text-fg-disabled">{t('empty.subtitle')}</p>
            </div>
          </div>
        ) : (
          <>
            <BreakdownCard
              scope={scope}
              totals={periodTotals}
              breakdown={breakdown}
              bdType={bdType}
              onBdTypeChange={setBdType}
              moneda={monedaPrincipal}
            />
            <div className="flex flex-col gap-2.5">
              {periodMovimientos.map((movimiento) => (
                <MovimientoRow
                  key={movimiento.id}
                  movimiento={movimiento}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
