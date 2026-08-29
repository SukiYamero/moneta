import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMonto } from '@/components/shared/movimientoView'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import type { Moneda } from '@/lib/schema'
import type { Totals } from '@/lib/movimientoStats'

export interface BalanceCardProps {
  totals: Totals
  moneda: Moneda
}

const HIDDEN_MASK = '••••••'
const HIDDEN_MASK_SMALL = '••••'

export const BalanceCard = ({ totals, moneda }: BalanceCardProps) => {
  const { t } = useTranslation('home')
  const { locale } = useLocaleFormatting()
  const [hidden, setHidden] = useState(false)

  return (
    <div className="-mx-3.5 mt-4 rounded-b-4xl border-t border-success/20 bg-success/10 px-5 py-4.5">
      <div className="flex items-center justify-between">
        <span className="text-ms font-semibold tracking-wide text-success">
          {t('balance.title')}
        </span>
        <button
          type="button"
          onClick={() => setHidden((v) => !v)}
          aria-label={t(hidden ? 'balance.show' : 'balance.hide')}
          aria-pressed={hidden}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <span className="flex size-8.5 items-center justify-center rounded-lg bg-success/15 text-success">
            {hidden ? (
              <EyeOff className="size-4.5" aria-hidden="true" />
            ) : (
              <Eye className="size-4.5" aria-hidden="true" />
            )}
          </span>
        </button>
      </div>
      <div className="mt-1.5 min-h-9.5 text-3xl font-extrabold tracking-tight">
        {hidden ? HIDDEN_MASK : formatMonto(totals.balance, moneda, locale)}
      </div>
      <div className="mt-4 flex gap-2.5">
        <div className="flex-1 rounded-2xl bg-surface-sunken px-3.5 py-2.75">
          <div className="flex items-center gap-1.75 text-sm font-semibold text-success">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-success/20">
              <ArrowDownLeft className="size-3" aria-hidden="true" />
            </span>
            {t('balance.income')}
          </div>
          <div className="mt-1.5 text-md font-bold">
            {hidden ? HIDDEN_MASK_SMALL : formatMonto(totals.ingresos, moneda, locale)}
          </div>
        </div>
        <div className="flex-1 rounded-2xl bg-surface-sunken px-3.5 py-2.75">
          <div className="flex items-center gap-1.75 text-sm font-semibold text-danger">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-danger/20">
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </span>
            {t('balance.expense')}
          </div>
          <div className="mt-1.5 text-md font-bold">
            {hidden ? HIDDEN_MASK_SMALL : formatMonto(totals.gastos, moneda, locale)}
          </div>
        </div>
      </div>
    </div>
  )
}
