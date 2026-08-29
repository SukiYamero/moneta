import { Bar, BarChart, Cell, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatMonto } from '@/components/shared/movimientoView'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { narrowDayLabel } from '@/features/home/homeView'
import { usePrefersReducedMotion } from '@/features/home/usePrefersReducedMotion'
import type { Moneda } from '@/lib/schema'
import type { SeriesBucket } from '@/lib/movimientoStats'

export interface WeeklyChartProps {
  chart: SeriesBucket[]
  totalGastos: number
  moneda: Moneda
  todayIso: string
}

type BarStatus = 'today' | 'zero' | 'value'

const BAR_FILL: Record<BarStatus, string> = {
  today: 'var(--primary)',
  zero: 'var(--color-border-subtle)',
  value: 'var(--color-fg-disabled)',
}

const barStatus = (bucket: SeriesBucket, todayIso: string): BarStatus => {
  if (bucket.bucketStart === todayIso) return 'today'
  if (bucket.gastos === 0) return 'zero'
  return 'value'
}

export const WeeklyChart = ({ chart, totalGastos, moneda, todayIso }: WeeklyChartProps) => {
  const { t } = useTranslation('home')
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div className="rounded-4xl border border-border-subtle bg-card px-4.5 pt-4.5 pb-3.5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-base font-bold">{t('chart.title')}</div>
          <div className="mt-0.75 text-sm font-medium text-fg-tertiary">{t('chart.subtitle')}</div>
        </div>
        <div className="text-4xl font-extrabold">{formatMonto(totalGastos, moneda, locale)}</div>
      </div>

      <div className="mt-4.5 h-31" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} barCategoryGap="28%">
            <Bar dataKey="gastos" radius={[8, 8, 0, 0]} isAnimationActive={!reducedMotion}>
              {chart.map((bucket) => (
                <Cell key={bucket.bucketStart} fill={BAR_FILL[barStatus(bucket, todayIso)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-between" aria-hidden="true">
        {chart.map((bucket) => (
          <span
            key={bucket.bucketStart}
            className={cn(
              'flex-1 text-center text-sm font-semibold',
              bucket.bucketStart === todayIso ? 'text-primary' : 'text-fg-tertiary',
            )}
          >
            {narrowDayLabel(bucket.bucketStart, dateFnsLocale)}
          </span>
        ))}
      </div>

      <span className="sr-only">
        {chart
          .map(
            (bucket) =>
              `${narrowDayLabel(bucket.bucketStart, dateFnsLocale)}: ${formatMonto(bucket.gastos, moneda, locale)}`,
          )
          .join(', ')}
      </span>
    </div>
  )
}
