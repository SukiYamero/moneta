import { useTranslation } from 'react-i18next'
import type { Categoria, Moneda, Periodo, TipoMovimiento } from '@/lib/schema'
import type { BreakdownEntry, Totals } from '@/lib/movimientoStats'
import {
  formatMonto,
  formatMontoWithSign,
  getMovimientoVisual,
  resolveCategoria,
} from '@/components/shared/movimientoView'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import { TINT_CLASSES } from '@/components/shared/tintClasses'
import { cn } from '@/lib/utils'

export interface BreakdownCardProps {
  scope: Periodo
  totals: Totals
  breakdown: BreakdownEntry[]
  bdType: TipoMovimiento
  onBdTypeChange: (tipo: TipoMovimiento) => void
  moneda: Moneda
  categorias: Categoria[]
  otherCurrencies: Moneda[]
}

const MIN_BAR_PERCENT = 3

export const BreakdownCard = ({
  scope,
  totals,
  breakdown,
  bdType,
  onBdTypeChange,
  moneda,
  categorias,
  otherCurrencies,
}: BreakdownCardProps) => {
  const { t } = useTranslation(['history', 'tags', 'common'])
  const { locale } = useLocaleFormatting()

  const balanceLabel: Record<Periodo, string> = {
    dia: t('balance.dia'),
    semana: t('balance.semana'),
    mes: t('balance.mes'),
    anio: t('balance.anio'),
  }

  const bdOptions: SegmentedControlOption<TipoMovimiento>[] = [
    { value: 'gasto', label: t('breakdown.gasto') },
    { value: 'ingreso', label: t('breakdown.ingreso') },
  ]

  const balanceNegative = totals.balance < 0
  const emptyMessage =
    bdType === 'ingreso' ? t('breakdown.emptyIngreso') : t('breakdown.emptyGasto')

  const otherCurrenciesLabel =
    otherCurrencies.length > 0
      ? new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(otherCurrencies)
      : null

  return (
    <div className="mb-3.5 rounded-3xl border border-border-subtle bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold tracking-wide text-fg-faint uppercase">
            {balanceLabel[scope]}
          </div>
          <div
            className={cn(
              'mt-1 text-2xl font-extrabold tracking-tight',
              balanceNegative ? 'text-danger' : 'text-foreground',
            )}
          >
            {formatMonto(totals.balance, moneda, locale)}
          </div>
        </div>
        <div className="shrink-0 pt-0.75 text-right">
          <div className="text-ms font-bold text-success">
            {formatMontoWithSign(totals.ingresos, moneda, locale)}
          </div>
          <div className="mt-1 text-ms font-bold text-foreground">
            {formatMontoWithSign(-totals.gastos, moneda, locale)}
          </div>
        </div>
      </div>

      {otherCurrenciesLabel && (
        <p className="mt-2 text-xs font-medium text-fg-tertiary">
          {t('common:otherCurrencyNote', { currencies: otherCurrenciesLabel })}
        </p>
      )}

      <div className="mt-4 border-t border-border-subtle pt-3.5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex-1 text-xs font-bold tracking-wide text-fg-faint uppercase">
            {t('breakdown.title')}
          </span>
          <SegmentedControl
            options={bdOptions}
            value={bdType}
            onChange={onBdTypeChange}
            aria-label={t('breakdown.title')}
            className="w-auto bg-surface-sunken"
          />
        </div>

        {breakdown.length === 0 ? (
          <p className="py-1.5 text-center text-ms font-semibold text-fg-disabled">
            {emptyMessage}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {breakdown.slice(0, 5).map((entry) => {
              const categoria = resolveCategoria(entry.key, { categorias })
              const { icon: Icon, tint } = getMovimientoVisual(categoria, bdType)
              const percent = Math.round(entry.share * 100)
              return (
                <div key={entry.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon
                      className={cn('size-3.5 shrink-0', TINT_CLASSES[tint].icon)}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-ms font-semibold text-fg-secondary">
                      {categoria?.nombre ?? t('tags:unknownCategory')}
                    </span>
                    <span className="text-ms font-bold">
                      {formatMonto(entry.total, moneda, locale)}
                    </span>
                    <span className="w-8.5 text-right text-xs font-semibold text-fg-faint">
                      {percent}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn('h-full rounded-full', TINT_CLASSES[tint].fill)}
                      style={{ width: `${Math.max(MIN_BAR_PERCENT, percent)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
