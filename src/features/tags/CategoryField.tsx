import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria, TipoMovimiento } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { TINT_CLASSES } from '@/components/shared/tintClasses'
import { getMovimientoVisual } from '@/components/shared/movimientoView'

export interface CategoryFieldProps {
  categoria?: Categoria
  tipo: TipoMovimiento
  onOpen: () => void
}

export const CategoryField = ({ categoria, tipo, onOpen }: CategoryFieldProps) => {
  const { t } = useTranslation('tags')
  const { icon: Icon, tint } = getMovimientoVisual(categoria, tipo)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-fg-tertiary uppercase">
        {t('sheet.fieldLabel')}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border-subtle bg-canvas px-3.5 py-2.5"
      >
        <span
          className={cn(
            'flex size-8.5 shrink-0 items-center justify-center rounded-sm',
            TINT_CLASSES[tint].badge,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left text-base font-bold',
            !categoria && 'font-semibold text-fg-tertiary',
          )}
        >
          {categoria ? categoria.nombre : t('sheet.fieldPlaceholder')}
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
      </button>
    </div>
  )
}
