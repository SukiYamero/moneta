import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, type Locale } from 'date-fns'
import {
  CONFIG_SEMILLA,
  type Categoria,
  type Movimiento,
  type Seccion,
  type Moneda,
} from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { toast } from '@/lib/toastStore'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { IconAvatar } from '@/components/shared/IconAvatar'
import {
  getMovimientoAmountView,
  getMovimientoVisual,
  resolveCategoria,
} from '@/components/shared/movimientoView'
import { MovimientoFormFields } from '@/features/movimientos/MovimientoFormFields'
import { useMovimientoForm } from '@/features/movimientos/useMovimientoForm'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

interface MovimientoViewProps {
  movimiento: Movimiento
  categoria: Categoria | undefined
  seccion: Seccion | undefined
  dateFnsLocale: Locale
  locale: string
  onEdit: () => void
  onDeleteRequested: () => void
}

const MovimientoView = ({
  movimiento,
  categoria,
  seccion,
  dateFnsLocale,
  locale,
  onEdit,
  onDeleteRequested,
}: MovimientoViewProps) => {
  const { t } = useTranslation(['movimientos', 'tags'])
  const { icon, tint } = getMovimientoVisual(categoria, movimiento.tipo)
  const amount = getMovimientoAmountView(movimiento, locale)
  const dateLabel = format(parseISO(movimiento.fecha), 'PPP', { locale: dateFnsLocale })
  const categoriaLabel = categoria?.nombre ?? t('tags:unknownCategory')

  return (
    <div className="flex flex-col gap-5 pb-1">
      <h2 className="sr-only">{t('movimientos:view.heading')}</h2>
      {/* No extra top padding here (specs.md §10.35/§10.41): every other
          sheet opens directly on its first visible content with no added
          `pt`, so this one shouldn't either — the `pt-2` this used to carry
          was compensating for having no *visible* heading, not a real
          spacing need, and started this sheet ~8px lower than the rest. */}
      <div className="flex flex-col items-center gap-3 text-center">
        <IconAvatar icon={icon} tint={tint} size="lg" />
        <div className={`text-3xl font-extrabold ${amount.colorClass}`}>{amount.text}</div>
        <div className="text-base font-bold">{categoriaLabel}</div>
        <div className="text-sm font-medium text-fg-tertiary capitalize">
          {dateLabel}
          {seccion ? ` · ${seccion.nombre}` : ''}
        </div>
        {movimiento.nota && <p className="text-sm text-fg-secondary">{movimiento.nota}</p>}
      </div>
      <div className="flex gap-2.5">
        <Button type="button" variant="secondary" size="touch" className="flex-1" onClick={onEdit}>
          {t('movimientos:view.editCta')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="touch"
          className="flex-1"
          onClick={onDeleteRequested}
        >
          {t('movimientos:view.deleteCta')}
        </Button>
      </div>
    </div>
  )
}

interface MovimientoEditFormProps {
  movimiento: Movimiento
  categorias: Categoria[]
  secciones: Seccion[]
  monedaPrincipal: Moneda
  primerDiaSemana: 0 | 1
  locale: string
  dateFnsLocale: MovimientoViewProps['dateFnsLocale']
  onCancel: () => void
  onSaved: () => void
}

const MovimientoEditForm = ({
  movimiento,
  categorias,
  secciones,
  monedaPrincipal,
  primerDiaSemana,
  locale,
  dateFnsLocale,
  onCancel,
  onSaved,
}: MovimientoEditFormProps) => {
  const { t } = useTranslation('movimientos')
  const form = useMovimientoForm({
    mode: 'edit',
    initial: movimiento,
    locale,
    monedaPrincipal,
    categorias,
    onSaved,
  })

  return (
    <div className="flex flex-col gap-5 pb-1">
      <h2 className="text-lg font-extrabold">{t('edit.heading')}</h2>
      <MovimientoFormFields
        tipo={form.tipo}
        onTipoChange={form.setTipo}
        amountRaw={form.amountRaw}
        onAmountChange={form.setAmountRaw}
        amountErrorReason={form.amountErrorReason}
        moneda={monedaPrincipal}
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
        firstDayOfWeek={primerDiaSemana}
        disabled={form.submitting}
      />
      <div className="flex gap-2.5">
        <Button
          type="button"
          variant="secondary"
          size="touch"
          className="flex-1"
          onClick={onCancel}
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
  )
}

/**
 * View ⇄ edit for an existing movement (specs.md §10.23 Decision 1). One
 * instance, mounted once in `AppShell`, driven by `movimientoSheetStore`'s
 * `viewId`. **Derives the record from `dataStore` on every render — never
 * caches a snapshot** (Decision 2): if the id it's showing stops resolving
 * (deleted elsewhere), the sheet closes itself and says so via a toast
 * rather than rendering a blank panel.
 */
export const MovimientoSheet = () => {
  const viewId = useMovimientoSheetStore((s) => s.viewId)
  const closeMovimiento = useMovimientoSheetStore((s) => s.closeMovimiento)
  const movimientos = useDataStore((s) => s.movimientos)
  const config = useDataStore((s) => s.config)
  const deleteMovimiento = useDataStore((s) => s.deleteMovimiento)
  const { t } = useTranslation('movimientos')
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isOpen = viewId !== null
  const movimiento = viewId ? movimientos.find((m) => m.id === viewId) : undefined

  // A fresh id (including the null -> id transition on open) always starts
  // in view mode — reopening the sheet must never resume a stale edit.
  useEffect(() => {
    setMode('view')
    setConfirmOpen(false)
  }, [viewId])

  // The movement vanishing underneath an open sheet (specs.md §10.23
  // Decision 2) — deleted on another device once sync exists, or by a
  // concurrent action on this one. Close and say so, never render blank.
  useEffect(() => {
    if (isOpen && movimiento === undefined) {
      closeMovimiento()
      toast.error('movimientos:vanished')
    }
  }, [isOpen, movimiento, closeMovimiento])

  const { secciones, categorias, preferencias } = config ?? CONFIG_SEMILLA
  const categoria = movimiento ? resolveCategoria(movimiento.categoria, { categorias }) : undefined
  const seccion = movimiento ? secciones.find((s) => s.id === movimiento.seccion) : undefined

  const handleDelete = async () => {
    if (!movimiento) return
    setConfirmOpen(false)
    const ok = await deleteMovimiento(movimiento.id)
    if (ok) closeMovimiento()
  }

  return (
    <>
      <BottomSheet
        open={isOpen && movimiento !== undefined}
        onClose={closeMovimiento}
        ariaLabel={t(mode === 'edit' ? 'edit.heading' : 'view.heading')}
      >
        {movimiento && mode === 'view' && (
          <MovimientoView
            movimiento={movimiento}
            categoria={categoria}
            seccion={seccion}
            dateFnsLocale={dateFnsLocale}
            locale={locale}
            onEdit={() => setMode('edit')}
            onDeleteRequested={() => setConfirmOpen(true)}
          />
        )}
        {movimiento && mode === 'edit' && (
          <MovimientoEditForm
            movimiento={movimiento}
            categorias={categorias}
            secciones={secciones}
            monedaPrincipal={preferencias.monedaPrincipal}
            primerDiaSemana={preferencias.primerDiaSemana}
            locale={locale}
            dateFnsLocale={dateFnsLocale}
            onCancel={() => setMode('view')}
            onSaved={() => setMode('view')}
          />
        )}
      </BottomSheet>
      {/* Rendered outside BottomSheet's children so it stacks as a nested
          overlay (useOverlay's own docs cite this exact case) rather than
          fighting the sheet's own scroll/drag container. */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
        title={t('deleteConfirm.title')}
        description={t('deleteConfirm.description')}
        confirmLabel={t('deleteConfirm.confirmCta')}
        cancelLabel={t('deleteConfirm.cancelCta')}
        destructive
      />
    </>
  )
}
