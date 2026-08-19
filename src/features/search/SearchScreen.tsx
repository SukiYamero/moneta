import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowUpDown, CalendarDays, Filter, Search as SearchIcon, X } from 'lucide-react'
import { useDataStore } from '@/lib/dataStore'
import { filterByRange } from '@/lib/movimientoStats'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { MovimientoRow } from '@/components/shared/MovimientoRow'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { FilterSheet } from '@/features/search/FilterSheet'
import { DATE_RANGE_LABEL_KEY } from '@/features/search/searchCopy'
import { matchesQuery } from '@/features/search/searchMatch'
import { useSearchFilters } from '@/features/search/useSearchFilters'

interface ActiveChip {
  key: string
  label: string
  icon: typeof CalendarDays
  onRemove: () => void
}

const LoadingState = ({ label }: { label: string }) => (
  <p className="pt-16 text-center text-sm font-medium text-fg-tertiary">{label}</p>
)

const ErrorState = ({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) => (
  <div className="flex flex-col items-center gap-3 pt-16 text-center">
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="min-h-11 rounded-lg border border-border-subtle px-4 text-sm font-bold text-fg-secondary"
    >
      {retryLabel}
    </button>
  </div>
)

const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex flex-col items-center gap-1 px-5 pt-16 text-center">
    <SearchIcon className="mb-3 size-9 text-fg-faint" aria-hidden="true" />
    <p className="text-md font-bold text-fg-secondary">{title}</p>
    <p className="text-sm font-medium text-fg-tertiary">{subtitle}</p>
  </div>
)

/**
 * Search + Filter sheet. Reads exclusively through `useDataStore` (never its
 * own repo call) so its numbers can never disagree with Home/History —
 * filtering itself is client-side over the already-loaded `movimientos`.
 */
export const SearchScreen = () => {
  const { t } = useTranslation('search')
  const status = useDataStore((s) => s.status)
  const error = useDataStore((s) => s.error)
  const movimientos = useDataStore((s) => s.movimientos)
  const config = useDataStore((s) => s.config)
  const load = useDataStore((s) => s.load)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  // Technical detail stays in console (docs/error-handling.md §7); the
  // screen itself only ever shows the translated, code-agnostic copy below.
  useEffect(() => {
    if (status === 'error') console.error('SearchScreen: dataStore load failed', error)
  }, [status, error])

  const filters = useSearchFilters()
  const ready = status === 'ready'
  const categories = config?.categorias ?? CONFIG_SEMILLA.categorias

  const categoryTipoByName = useMemo(
    () => new Map(categories.map((category) => [category.nombre, category.tipo])),
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
      result = result.filter((m) => matchesQuery(filters.debouncedQuery, m.nota ?? '', m.categoria))
    }
    return result.toSorted((a, b) => b.fecha.localeCompare(a.fecha))
  }, [
    movimientos,
    filters.dateRange,
    filters.typeFilter,
    filters.selectedTags,
    filters.debouncedQuery,
  ])

  const hasNoDataAtAll = ready && movimientos.length === 0
  const hasNoResults = ready && !hasNoDataAtAll && filteredMovimientos.length === 0
  const hasQuery = filters.debouncedQuery.trim().length > 0

  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = []
    if (filters.rangePreset !== 'all') {
      const label =
        filters.rangePreset === 'custom'
          ? `${format(parseISO(filters.customFrom), 'd MMM', { locale: es })} – ${format(parseISO(filters.customTo), 'd MMM', { locale: es })}`
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
      const tipo = categoryTipoByName.get(tag) ?? 'gasto'
      chips.push({
        key: `tag-${tag}`,
        label: tag,
        icon: getMovimientoVisual({ categoria: tag, tipo }).icon,
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
    categoryTipoByName,
    t,
  ])

  return (
    <main className="flex min-h-full animate-fade-in flex-col px-5 pt-6 pb-(--bottom-nav-clearance)">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-5xl font-extrabold tracking-tight text-balance">{t('title')}</h1>
          {ready && (
            <p className="mt-0.5 text-xs font-medium text-fg-tertiary">
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
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-fg-secondary"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/35 bg-primary/12 px-3 text-xs font-semibold whitespace-nowrap text-primary"
            >
              <chip.icon className="size-3.5" aria-hidden="true" />
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1">
        {(status === 'idle' || status === 'loading') && <LoadingState label={t('loading')} />}

        {status === 'error' && (
          <ErrorState message={t('error')} retryLabel={t('retry')} onRetry={() => void load()} />
        )}

        {hasNoDataAtAll && (
          <EmptyState title={t('emptyData.title')} subtitle={t('emptyData.subtitle')} />
        )}

        {hasNoResults && (
          <EmptyState
            title={t('emptyResults.title')}
            subtitle={
              hasQuery
                ? t('emptyResults.withQuery', { query: filters.query })
                : t('emptyResults.withoutQuery')
            }
          />
        )}

        {ready && filteredMovimientos.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {filteredMovimientos.map((movimiento) => (
              // STUB(trackF): open the Movement view/edit sheet once it exists
              // (Wave 3) — until then a search result row is display-only.
              <MovimientoRow key={movimiento.id} movimiento={movimiento} />
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
        resultCount={filteredMovimientos.length}
      />
    </main>
  )
}
