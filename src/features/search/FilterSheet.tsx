import { useTranslation } from 'react-i18next'
import type { Locale } from 'date-fns'
import type { Categoria } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import { TagChip } from '@/components/shared/TagChip'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { DATE_RANGE_LABEL_KEY, DATE_RANGE_PRESETS } from '@/features/search/searchCopy'
import type { MovementTypeFilter, UseSearchFiltersResult } from '@/features/search/useSearchFilters'

export interface FilterSheetProps {
  open: boolean
  onClose: () => void
  filters: UseSearchFiltersResult
  categories: Categoria[]
  firstDayOfWeek: 0 | 1
  locale: string
  dateFnsLocale: Locale
  resultCount: number
}

const SectionHeading = ({ children }: { children: string }) => (
  <h3 className="mb-2.5 text-xs font-bold tracking-wide text-fg-tertiary uppercase">{children}</h3>
)

/**
 * The Filter sheet: date-range presets + calendar, type, tags. No separate
 * "apply" — every tap commits straight into `useSearchFilters`'s shared
 * state, so `SearchScreen`'s result list (and this sheet's own "Ver N"
 * button) update live as the user filters, matching the source design.
 */
export const FilterSheet = ({
  open,
  onClose,
  filters,
  categories,
  firstDayOfWeek,
  locale,
  dateFnsLocale,
  resultCount,
}: FilterSheetProps) => {
  const { t } = useTranslation('search')

  const typeOptions: SegmentedControlOption<MovementTypeFilter>[] = [
    { value: 'all', label: t('filters.type.all') },
    { value: 'gasto', label: t('filters.type.gasto') },
    { value: 'ingreso', label: t('filters.type.ingreso') },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t('filters.heading')}>
      <div className="flex flex-col gap-5 pb-1">
        <div>
          <SectionHeading>{t('filters.dateRange.heading')}</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {DATE_RANGE_PRESETS.map((preset) => {
              const selected = filters.rangePreset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => filters.setRangePreset(preset)}
                  aria-pressed={selected}
                  className={cn(
                    'min-h-11 rounded-md border px-3.5 text-ms font-semibold whitespace-nowrap transition-colors',
                    selected
                      ? 'border-primary/45 bg-primary/15 text-foreground'
                      : 'border-border-subtle bg-surface-sunken text-fg-secondary',
                  )}
                >
                  {t(DATE_RANGE_LABEL_KEY[preset])}
                </button>
              )
            })}
          </div>

          {filters.rangePreset === 'custom' && (
            <div className="mt-3.5 flex flex-wrap items-start gap-4">
              <div className="flex flex-col gap-1.5 text-xs font-bold text-fg-tertiary">
                {t('filters.dateRange.from')}
                <DateChipPicker
                  value={filters.customFrom}
                  onChange={filters.setCustomFrom}
                  firstDayOfWeek={firstDayOfWeek}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-xs font-bold text-fg-tertiary">
                {t('filters.dateRange.to')}
                <DateChipPicker
                  value={filters.customTo}
                  onChange={filters.setCustomTo}
                  firstDayOfWeek={firstDayOfWeek}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <SectionHeading>{t('filters.type.heading')}</SectionHeading>
          <SegmentedControl
            options={typeOptions}
            value={filters.typeFilter}
            onChange={filters.setTypeFilter}
            aria-label={t('filters.type.heading')}
          />
        </div>

        <div>
          <SectionHeading>{t('filters.tags.heading')}</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const { icon } = getMovimientoVisual({
                categoria: category.nombre,
                tipo: category.tipo,
              })
              return (
                <TagChip
                  key={category.id}
                  icon={icon}
                  label={category.nombre}
                  selected={filters.selectedTags.includes(category.nombre)}
                  onClick={() => filters.toggleTag(category.nombre)}
                />
              )
            })}
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={filters.clearFilters}
            className="min-h-11 rounded-lg border border-border-subtle px-5 text-sm font-bold text-fg-secondary"
          >
            {t('filters.clear')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-lg bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-sm font-extrabold text-primary-foreground"
          >
            {t('filters.apply', { count: resultCount })}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
