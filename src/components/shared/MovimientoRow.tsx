import { format, parseISO, type Locale } from 'date-fns'
import { CircleHelp } from 'lucide-react'
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { Categoria, Movimiento } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { IconAvatar } from '@/components/shared/IconAvatar'
import {
  getMovimientoAmountView,
  getMovimientoVisual,
  resolveCategoria,
} from '@/components/shared/movimientoView'

export interface MovimientoRowProps {
  movimiento: Movimiento
  /**
   * `Config.categorias` — required, no default (same no-silent-fallback rule
   * as `locale`/`dateFnsLocale` below): `movimiento.categoria` is an id
   * (specs.md §10.22), and resolving it to a label/icon/color needs this to
   * be in scope rather than read from a store this component doesn't touch.
   */
  categorias: Categoria[]
  onClick?: () => void
  /** "Estimado" badge — used for movements the History screen projects, not yet confirmed. */
  pending?: boolean
  /** Overrides the default `fecha`-derived label (e.g. "Hoy · 09:00" once a screen has that context). */
  meta?: string
  className?: string
  ref?: Ref<HTMLDivElement>
  /**
   * BCP-47 locale for the amount's currency formatting (forwarded to
   * `movimientoView.formatMonto`). Required, no default — this component
   * stays i18n-agnostic, the same way it takes `pending`/`meta` rather than
   * reading a store itself; the calling screen reads the active i18next
   * locale (`useLocaleFormatting()`) and passes it down (mirrors
   * `DateChipPicker`'s `firstDayOfWeek` prop, specs.md §10.5). A missing
   * value is a compile error rather than a silently es-CO row
   * (docs/wave-2/track-m.md).
   */
  locale: string
  /** date-fns `Locale` for the date label — same no-default rule as `locale` above. */
  dateFnsLocale: Locale
}

export const MovimientoRow = ({
  movimiento,
  categorias,
  onClick,
  pending,
  meta,
  className,
  ref,
  locale,
  dateFnsLocale,
}: MovimientoRowProps) => {
  const { t } = useTranslation('tags')
  const categoria = resolveCategoria(movimiento.categoria, { categorias })
  const { icon, tint } = getMovimientoVisual(categoria, movimiento.tipo)
  const amount = getMovimientoAmountView(movimiento, locale)
  const label = meta ?? format(parseISO(movimiento.fecha), 'd MMM', { locale: dateFnsLocale })
  const categoriaLabel = movimiento.nota || categoria?.nombre || t('unknownCategory')
  const isInteractive = onClick !== undefined

  return (
    <div
      ref={ref}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-xl border border-border-subtle bg-card px-3.5 py-3',
        isInteractive && 'cursor-pointer',
        className,
      )}
    >
      <IconAvatar icon={icon} tint={tint} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{categoriaLabel}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-xs font-medium text-fg-tertiary">{label}</span>
          {pending && (
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-warning/15 px-1.5 py-0.5 text-2xs font-extrabold text-warning">
              <CircleHelp className="size-2.5" /> Estimado
            </span>
          )}
        </div>
      </div>
      <div className={cn('text-base font-bold', amount.colorClass)}>{amount.text}</div>
    </div>
  )
}
