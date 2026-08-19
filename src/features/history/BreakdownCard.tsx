import { useTranslation } from 'react-i18next'
import type { Moneda, Periodo, TipoMovimiento } from '@/lib/schema'
import type { BreakdownEntry, Totals } from '@/lib/movimientoStats'
import { formatMonto, getMovimientoVisual } from '@/components/shared/movimientoView'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { cn } from '@/lib/utils'

export interface BreakdownCardProps {
  scope: Periodo
  totals: Totals
  breakdown: BreakdownEntry[]
  bdType: TipoMovimiento
  onBdTypeChange: (tipo: TipoMovimiento) => void
  moneda: Moneda
}

// Presentation-only: the progress bar needs a solid fill, `IconAvatar`'s own
// tint classes are all translucent (`bg-chart-1/15`) for the icon badge use
// case. Maps onto the same chart/status tokens, no new hex.
const FILL_CLASS: Record<IconAvatarTint, string> = {
  emerald: 'bg-chart-1',
  blue: 'bg-chart-2',
  amber: 'bg-chart-3',
  rose: 'bg-chart-4',
  purple: 'bg-chart-5',
  success: 'bg-success',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
}

const MIN_BAR_PERCENT = 3

export const BreakdownCard = ({
  scope,
  totals,
  breakdown,
  bdType,
  onBdTypeChange,
  moneda,
}: BreakdownCardProps) => {
  const { t } = useTranslation('history')

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
            {balanceNegative ? '-' : ''}
            {formatMonto(Math.abs(totals.balance), moneda)}
          </div>
        </div>
        <div className="shrink-0 pt-0.75 text-right">
          <div className="text-ms font-bold text-success">
            +{formatMonto(totals.ingresos, moneda)}
          </div>
          <div className="mt-1 text-ms font-bold text-foreground">
            -{formatMonto(totals.gastos, moneda)}
          </div>
        </div>
      </div>

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
              const { icon: Icon, tint } = getMovimientoVisual({
                categoria: entry.key,
                tipo: bdType,
              })
              const percent = Math.round(entry.share * 100)
              return (
                <div key={entry.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon
                      className={cn('size-3.5 shrink-0', FILL_CLASS[tint].replace('bg-', 'text-'))}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-ms font-semibold text-fg-secondary">
                      {entry.key}
                    </span>
                    <span className="text-ms font-bold">{formatMonto(entry.total, moneda)}</span>
                    <span className="w-8.5 text-right text-xs font-semibold text-fg-faint">
                      {percent}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn('h-full rounded-full', FILL_CLASS[tint])}
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
