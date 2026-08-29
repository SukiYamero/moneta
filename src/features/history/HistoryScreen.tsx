import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CONFIG_SEMILLA, type Periodo, type TipoMovimiento } from '@/lib/schema'
import {
  breakdownBy,
  filterByRange,
  otherCurrencies,
  periodRange,
  totals,
} from '@/lib/movimientoStats'
import { useDataStore } from '@/lib/dataStore'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import {
  InlineErrorState,
  MovimientoRow,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
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
import { useMovimientoSheetStore } from '@/features/movimientos'

const SCOPES: Periodo[] = ['dia', 'semana', 'mes', 'anio']

export const HistoryScreen = () => {
  const { t } = useTranslation('history')
  const { movimientos, config, status, error, load } = useDataStore()
  const { scope, anchor, setScope, selectAnchor, step, selectYear } = useHistoryPeriod()
  const [bdType, setBdType] = useState<TipoMovimiento>('gasto')
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const openMovimiento = useMovimientoSheetStore((s) => s.openMovimiento)

  useEffect(() => {
    void load()
  }, [load])

  const isPending = status === 'idle' || status === 'loading'
  const showLoading = usePendingDelay(isPending)

  const { primerDiaSemana, monedaPrincipal } = (config ?? CONFIG_SEMILLA).preferencias
  const categorias = config?.categorias ?? CONFIG_SEMILLA.categorias
  const range = periodRange(scope, anchor, primerDiaSemana)
  const periodMovimientos = filterByRange(movimientos, range)
  const periodTotals = totals(periodMovimientos, monedaPrincipal)
  const breakdown = breakdownBy(periodMovimientos, bdType, monedaPrincipal)
  const periodOtherCurrencies = otherCurrencies(periodMovimientos, monedaPrincipal)
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

  const weekBoundaryUnknown = scope === 'semana' && config === null

  return (
    <main className="flex min-h-full animate-push-in flex-col pt-(--screen-inset-top)">
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
          {weekBoundaryUnknown ? (
            <SkeletonGroup label={t('loading')} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </SkeletonGroup>
          ) : (
            <>
              <div className="truncate text-xl font-extrabold tracking-tight capitalize">
                {label.title}
              </div>
              <div className="truncate text-sm font-medium text-fg-tertiary capitalize">
                {label.subtitle}
              </div>
            </>
          )}
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

      {pickerKind !== 'none' && !weekBoundaryUnknown && (
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
              <p className="mt-1 text-sm font-medium text-fg-disabled">{t('empty.subtitle')}</p>
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
              categorias={categorias}
              otherCurrencies={periodOtherCurrencies}
            />
            <div className="flex flex-col gap-2.5">
              {periodMovimientos.map((movimiento) => (
                <MovimientoRow
                  key={movimiento.id}
                  movimiento={movimiento}
                  categorias={categorias}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                  onClick={() => openMovimiento(movimiento.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
