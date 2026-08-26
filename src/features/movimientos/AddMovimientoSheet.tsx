import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CONFIG_SEMILLA, type TipoMovimiento } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { MovimientoFormFields } from '@/features/movimientos/MovimientoFormFields'
import { MOVIMIENTO_PRIMARY_CTA_CLASS } from '@/features/movimientos/movimientoPrimaryCta'
import { useMovimientoForm } from '@/features/movimientos/useMovimientoForm'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

const ADD_CTA_KEY = {
  gasto: 'form.addCta.gasto',
  ingreso: 'form.addCta.ingreso',
} as const satisfies Record<TipoMovimiento, string>

export const AddMovimientoSheet = () => {
  const open = useMovimientoSheetStore((s) => s.addOpen)
  const closeAdd = useMovimientoSheetStore((s) => s.closeAdd)
  const config = useDataStore((s) => s.config)
  const { t } = useTranslation('movimientos')
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const amountInputRef = useRef<HTMLInputElement>(null)

  const { secciones, categorias, preferencias } = config ?? CONFIG_SEMILLA

  const form = useMovimientoForm({
    mode: 'create',
    locale,
    monedaPrincipal: preferencias.monedaPrincipal,
    categorias,
    onSaved: closeAdd,
  })

  const handleClose = () => {
    form.reset()
    closeAdd()
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      ariaLabel={t('add.heading')}
      initialFocus={amountInputRef}
    >
      <div className="flex flex-col gap-5 pb-1">
        <MovimientoFormFields
          tipo={form.tipo}
          onTipoChange={form.setTipo}
          amountRaw={form.amountRaw}
          onAmountChange={form.setAmountRaw}
          amountErrorReason={form.amountErrorReason}
          amountInputRef={amountInputRef}
          submitAttempts={form.submitAttempts}
          moneda={preferencias.monedaPrincipal}
          fecha={form.fecha}
          onFechaChange={form.setFecha}
          categorias={categorias}
          secciones={secciones}
          categoriaId={form.categoriaId}
          onSelectCategoria={form.selectCategoria}
          categoriaMissing={form.categoriaMissing}
          nota={form.nota}
          onNotaChange={form.setNota}
          locale={locale}
          dateFnsLocale={dateFnsLocale}
          firstDayOfWeek={preferencias.primerDiaSemana}
          disabled={form.submitting}
        />
        <Button
          type="button"
          size="touch"
          className={cn('w-full', MOVIMIENTO_PRIMARY_CTA_CLASS)}
          disabled={form.submitting}
          onClick={() => void form.submit()}
        >
          {t(ADD_CTA_KEY[form.tipo])}
        </Button>
      </div>
    </BottomSheet>
  )
}
