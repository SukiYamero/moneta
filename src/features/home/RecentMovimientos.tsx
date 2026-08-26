import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { MovimientoRow } from '@/components/shared/MovimientoRow'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import type { Categoria, Movimiento } from '@/lib/schema'
import { useMovimientoSheetStore } from '@/features/movimientos'

export interface RecentMovimientosProps {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export const RecentMovimientos = ({ movimientos, categorias }: RecentMovimientosProps) => {
  const { t } = useTranslation('home')
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const openMovimiento = useMovimientoSheetStore((s) => s.openMovimiento)

  return (
    <section aria-labelledby="home-recent-heading">
      <div className="mb-3.5 flex items-center justify-between px-1">
        <h2 id="home-recent-heading" className="text-lg font-bold">
          {t('recent.title')}
        </h2>
        <Link
          to="/history"
          className="flex min-h-11 items-center text-ms font-semibold text-primary"
        >
          {t('recent.viewAll')}
        </Link>
      </div>
      <div className="flex flex-col gap-2.5">
        {movimientos.map((m) => (
          <MovimientoRow
            key={m.id}
            movimiento={m}
            categorias={categorias}
            locale={locale}
            dateFnsLocale={dateFnsLocale}
            onClick={() => openMovimiento(m.id)}
          />
        ))}
      </div>
    </section>
  )
}
