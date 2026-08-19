import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { MovimientoRow } from '@/components/shared/MovimientoRow'
import type { Movimiento } from '@/lib/schema'

export interface RecentMovimientosProps {
  movimientos: Movimiento[]
}

export const RecentMovimientos = ({ movimientos }: RecentMovimientosProps) => {
  const { t } = useTranslation('home')

  return (
    <section aria-labelledby="home-recent-heading">
      <div className="mb-3.5 flex items-center justify-between px-1">
        <h2 id="home-recent-heading" className="text-lg font-bold">
          {t('recent.title')}
        </h2>
        <Link to="/history" className="text-ms font-semibold text-primary">
          {t('recent.viewAll')}
        </Link>
      </div>
      <div className="flex flex-col gap-2.5">
        {movimientos.map((m) => (
          <MovimientoRow key={m.id} movimiento={m} />
        ))}
      </div>
    </section>
  )
}
