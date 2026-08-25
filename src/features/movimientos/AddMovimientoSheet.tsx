import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CONFIG_SEMILLA, type TipoMovimiento } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { MovimientoFormFields } from '@/features/movimientos/MovimientoFormFields'
import { useMovimientoForm } from '@/features/movimientos/useMovimientoForm'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

// `as const satisfies Record<...>` (not a template-literal `t()` call) for
// the same reason `MovimientoFormFields`' `AMOUNT_ERROR_KEY` is one: `t()`'s
// typed keys only accept a real resource path, not a widened `string`.
// The artboard's `{{addLabel}}` binding names the action being created and
// changes with the type toggle ("Agregar gasto"/"Agregar ingreso") — a
// generic "Save" is the old vertical-form's copy, not what this sheet draws.
const ADD_CTA_KEY = {
  gasto: 'form.addCta.gasto',
  ingreso: 'form.addCta.ingreso',
} as const satisfies Record<TipoMovimiento, string>

/**
 * `BottomSheet` + `useMovimientoForm` in create mode (specs.md §10.23,
 * §10.41). One instance, mounted once in `AppShell` beside `ProfileSheet`,
 * opened by the `BottomNav` FAB via `movimientoSheetStore`.
 *
 * No visible heading — `docs/ui/design-export-add-sheet.md` §2 draws the
 * sheet's header row as the grab handle alone (`BottomSheet` already
 * renders that as fixed chrome); `ariaLabel` below still names the dialog
 * for assistive tech. No Cancel button either: the export's action row is
 * camera + primary + mic, never a text Cancel, and the camera/mic are
 * deliberately not rendered (specs.md §10.41 Decision, preserving §10.23
 * Decision 5) — the remaining primary button takes the row's full width.
 * Dismissing without saving is the sheet's existing backdrop-tap/Escape/
 * drag-to-dismiss, all already wired through `handleClose` below.
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
        <MovimientoFormFields
          tipo={form.tipo}
          onTipoChange={form.setTipo}
          amountRaw={form.amountRaw}
          onAmountChange={form.setAmountRaw}
          amountErrorReason={form.amountErrorReason}
          amountInputRef={amountInputRef}
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
          className="w-full"
          disabled={form.submitting}
          onClick={() => void form.submit()}
        >
          {t(ADD_CTA_KEY[form.tipo])}
        </Button>
      </div>
    </BottomSheet>
  )
}
