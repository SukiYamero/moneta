import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { MovimientoFormFields } from '@/features/movimientos/MovimientoFormFields'
import { useMovimientoForm } from '@/features/movimientos/useMovimientoForm'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

/**
 * `BottomSheet` + `useMovimientoForm` in create mode (specs.md §10.23).
 * One instance, mounted once in `AppShell` beside `ProfileSheet`, opened by
 * the `BottomNav` FAB via `movimientoSheetStore`.
 */
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

  // Every dismissal path (backdrop tap, Escape, drag-to-dismiss, Cancel)
  // routes through BottomSheet's own onClose — wiring the reset here once
  // covers all of them, rather than duplicating it on the Cancel button.
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
        <h2 className="text-lg font-extrabold">{t('add.heading')}</h2>
        <MovimientoFormFields
          tipo={form.tipo}
          onTipoChange={form.setTipo}
          amountRaw={form.amountRaw}
          onAmountChange={form.setAmountRaw}
          amountErrorReason={form.amountErrorReason}
          amountInputRef={amountInputRef}
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
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="flex-1"
            onClick={handleClose}
          >
            {t('form.cancelCta')}
          </Button>
          <Button
            type="button"
            size="touch"
            className="flex-1"
            disabled={form.submitting}
            onClick={() => void form.submit()}
          >
            {t('form.saveCta')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
