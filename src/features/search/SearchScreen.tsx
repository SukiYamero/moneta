import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { ArrowUpDown, CalendarDays, Filter, Search as SearchIcon, X } from 'lucide-react'
import { useDataStore } from '@/lib/dataStore'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { filterByRange } from '@/lib/movimientoStats'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { InlineErrorState, usePendingDelay } from '@/components/shared'
import { MovimientoRow } from '@/components/shared/MovimientoRow'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { FilterSheet } from '@/features/search/FilterSheet'
import { SearchLoadingState } from '@/features/search/SearchLoadingState'
import { DATE_RANGE_LABEL_KEY } from '@/features/search/searchCopy'
import { matchesQuery } from '@/features/search/searchMatch'
import { useSearchFilters } from '@/features/search/useSearchFilters'
import { useMovimientoSheetStore } from '@/features/movimientos'

interface ActiveChip {
  key: string
  label: string
  icon: typeof CalendarDays
  onRemove: () => void
}

const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex flex-col items-center gap-1 px-5 pt-16 text-center">
    <SearchIcon className="mb-3 size-9 text-fg-faint" aria-hidden="true" />
    <p className="text-md font-bold text-fg-secondary">{title}</p>
    <p className="text-sm font-medium text-fg-tertiary">{subtitle}</p>
  </div>
)

export const SearchScreen = () => {
  const { t } = useTranslation(['search', 'tags'])
  const status = useDataStore((s) => s.status)
  const error = useDataStore((s) => s.error)
  const movimientos = useDataStore((s) => s.movimientos)
  const config = useDataStore((s) => s.config)
  const load = useDataStore((s) => s.load)
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const openMovimiento = useMovimientoSheetStore((s) => s.openMovimiento)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (status === 'error') console.error('SearchScreen: dataStore load failed', error)
  }, [status, error])

  const filters = useSearchFilters()
  const ready = status === 'ready'
  const isPending = status === 'idle' || status === 'loading'
  const showLoading = usePendingDelay(isPending)
  const categories = config?.categorias ?? CONFIG_SEMILLA.categorias

  const categoriaById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const filteredMovimientos = useMemo(() => {
    let result = movimientos
    if (filters.dateRange) result = filterByRange(result, filters.dateRange)
    if (filters.typeFilter !== 'all') result = result.filter((m) => m.tipo === filters.typeFilter)
    if (filters.selectedTags.length > 0) {
      const tagSet = new Set(filters.selectedTags)
      result = result.filter((m) => tagSet.has(m.categoria))
    }
    if (filters.debouncedQuery) {
      result = result.filter((m) =>
        matchesQuery(
          filters.debouncedQuery,
          m.nota ?? '',
          categoriaById.get(m.categoria)?.nombre ?? '',
        ),
      )
    }
    return result.toSorted((a, b) => b.fecha.localeCompare(a.fecha))
  }, [
    movimientos,
    filters.dateRange,
    filters.typeFilter,
    filters.selectedTags,
    filters.debouncedQuery,
    categoriaById,
  ])

  const hasNoDataAtAll = ready && movimientos.length === 0
  const hasNoResults = ready && !hasNoDataAtAll && filteredMovimientos.length === 0
  const hasQuery = filters.debouncedQuery.trim().length > 0

  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = []
    if (filters.rangePreset !== 'all') {
      const label =
        filters.rangePreset === 'custom'
          ? `${format(parseISO(filters.customFrom), 'd MMM', { locale: dateFnsLocale })} – ${format(parseISO(filters.customTo), 'd MMM', { locale: dateFnsLocale })}`
          : t(DATE_RANGE_LABEL_KEY[filters.rangePreset])
      chips.push({
        key: 'range',
        label,
        icon: CalendarDays,
        onRemove: () => filters.setRangePreset('all'),
      })
    }
    if (filters.typeFilter !== 'all') {
      chips.push({
        key: 'type',
        label: t(`filters.type.${filters.typeFilter}`),
        icon: ArrowUpDown,
        onRemove: () => filters.setTypeFilter('all'),
      })
    }
    for (const tag of filters.selectedTags) {
      const category = categoriaById.get(tag)
      chips.push({
        key: `tag-${tag}`,
        label: category?.nombre ?? t('tags:unknownCategory'),
        icon: getMovimientoVisual(category, 'gasto').icon,
        onRemove: () => filters.toggleTag(tag),
      })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.rangePreset,
    filters.customFrom,
    filters.customTo,
    filters.typeFilter,
    filters.selectedTags,
    categoriaById,
    dateFnsLocale,
    t,
  ])

  return (
    <main className="flex min-h-full animate-fade-in flex-col px-5 pt-(--screen-inset-top)">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-5xl font-extrabold tracking-tight text-balance">{t('title')}</h1>
          {ready && (
            <p className="mt-0.5 text-sm font-medium text-fg-tertiary">
              {t('resultsCount', { count: filteredMovimientos.length })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          disabled={!ready}
          aria-label={t('filterButtonLabel')}
          aria-expanded={filtersOpen}
          className={cn(
            'relative flex size-11 shrink-0 items-center justify-center rounded-md disabled:opacity-50',
            filters.isFilterActive
              ? 'bg-primary/15 text-primary'
              : 'bg-surface-sunken text-fg-secondary',
          )}
        >
          <Filter className="size-4.5" aria-hidden="true" />
          {filters.isFilterActive && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 size-1.75 rounded-full border-2 border-background bg-success"
            />
          )}
        </button>
      </div>

      <div className="mt-4 flex h-12 items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-sunken px-3.5">
        <SearchIcon className="size-4.5 shrink-0 text-fg-faint" aria-hidden="true" />
        <input
          type="text"
          value={filters.query}
          onChange={(event) => filters.setQuery(event.target.value)}
          placeholder={t('searchInputLabel')}
          aria-label={t('searchInputLabel')}
          disabled={!ready}
          className="min-w-0 flex-1 bg-transparent text-md font-medium outline-none placeholder:text-fg-faint disabled:cursor-not-allowed"
        />
        {filters.query.length > 0 && (
          <button
            type="button"
            onClick={filters.clearSearch}
            aria-label={t('clearSearchLabel')}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-fg-secondary">
              <X className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex min-h-11 shrink-0 items-center"
            >
              <span className="flex h-9 items-center gap-1.5 rounded-md border border-primary/35 bg-primary/12 px-3 text-sm font-semibold whitespace-nowrap text-primary">
                <chip.icon className="size-3.5" aria-hidden="true" />
                {chip.label}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1">
        {showLoading && <SearchLoadingState />}

        {status === 'error' && (
          <InlineErrorState
            message={t(repoErrorCopyKey(error ?? 'unknown'))}
            retryLabel={t('retry')}
            onRetry={() => void load()}
          />
        )}

        {hasNoDataAtAll && (
          <EmptyState title={t('emptyData.title')} subtitle={t('emptyData.subtitle')} />
        )}

        {hasNoResults && (
          <EmptyState
            title={t('emptyResults.title')}
            subtitle={
              hasQuery
                ? t('emptyResults.withQuery', { query: filters.debouncedQuery })
                : t('emptyResults.withoutQuery')
            }
          />
        )}

        {ready && filteredMovimientos.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {filteredMovimientos.map((movimiento) => (
              <MovimientoRow
                key={movimiento.id}
                movimiento={movimiento}
                categorias={categories}
                locale={locale}
                dateFnsLocale={dateFnsLocale}
                onClick={() => openMovimiento(movimiento.id)}
              />
            ))}
          </div>
        )}
      </div>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        categories={categories}
        firstDayOfWeek={
          config?.preferencias.primerDiaSemana ?? CONFIG_SEMILLA.preferencias.primerDiaSemana
        }
        locale={locale}
        dateFnsLocale={dateFnsLocale}
        resultCount={filteredMovimientos.length}
      />
    </main>
  )
}
