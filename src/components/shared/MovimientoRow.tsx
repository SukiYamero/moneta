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
  categorias: Categoria[]
  onClick?: () => void
  pending?: boolean
  meta?: string
  className?: string
  ref?: Ref<HTMLDivElement>
  locale: string
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
          <span className="text-sm font-medium text-fg-tertiary">{label}</span>
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
