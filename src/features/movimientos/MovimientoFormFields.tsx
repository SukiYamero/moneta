import { useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { Locale } from 'date-fns'
import type { Categoria, Seccion, TipoMovimiento } from '@/lib/schema'
import { AmountField } from '@/components/shared/AmountField'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import { TextField } from '@/components/shared/TextField'
import { CategoryPicker, CategoryFormModal } from '@/features/tags'
import type { AmountErrorReason } from '@/features/movimientos/useMovimientoForm'

// `as const` (not `Record<AmountErrorReason, string>`) so each value keeps
// its literal type — `t()`'s typed keys only accept a real resource path,
// not a widened `string` (mirrors `CategoryFormModal`'s `COLOR_NAME_KEY`).
const AMOUNT_ERROR_KEY = {
  empty: 'form.amount.errors.empty',
  malformed: 'form.amount.errors.malformed',
  not_positive: 'form.amount.errors.notPositive',
} as const satisfies Record<AmountErrorReason, string>

export interface MovimientoFormFieldsProps {
  tipo: TipoMovimiento
  onTipoChange: (tipo: TipoMovimiento) => void
  amountRaw: string
  onAmountChange: (raw: string) => void
  amountErrorReason?: AmountErrorReason
  amountInputRef?: Ref<HTMLInputElement>
  fecha: string
  onFechaChange: (iso: string) => void
  categorias: Categoria[]
  secciones: Seccion[]
  categoriaId?: string
  onSelectCategoria: (categoria: Categoria) => void
  categoriaMissing: boolean
  nota: string
  onNotaChange: (value: string) => void
  locale: string
  dateFnsLocale: Locale
  firstDayOfWeek: 0 | 1
  disabled?: boolean
}

/**
 * The field set shared by the create sheet and the edit form (specs.md
 * §10.23 Decision 1) — presentational, driven entirely by
 * `useMovimientoForm`'s return value. The only local state it owns is the
 * "create category from query" modal's open/prefill, which is a UI
 * concern, not form validation.
 *
 * Deliberately renders no scan/voice button (Decision 5) — the seam for
 * stage 3 is `useMovimientoForm`'s `applyParsedFields`, not a stub here.
 */
export const MovimientoFormFields = ({
  tipo,
  onTipoChange,
  amountRaw,
  onAmountChange,
  amountErrorReason,
  amountInputRef,
  fecha,
  onFechaChange,
  categorias,
  secciones,
  categoriaId,
  onSelectCategoria,
  categoriaMissing,
  nota,
  onNotaChange,
  locale,
  dateFnsLocale,
  firstDayOfWeek,
  disabled,
}: MovimientoFormFieldsProps) => {
  const { t } = useTranslation('movimientos')
  const [createCategory, setCreateCategory] = useState<{ open: boolean; initialName?: string }>({
    open: false,
  })

  const typeOptions: SegmentedControlOption<TipoMovimiento>[] = [
    { value: 'gasto', label: t('form.type.gasto') },
    { value: 'ingreso', label: t('form.type.ingreso') },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={typeOptions}
        value={tipo}
        onChange={onTipoChange}
        aria-label={t('form.typeAriaLabel')}
      />

      <AmountField
        label={t('form.amountLabel')}
        value={amountRaw}
        onChange={onAmountChange}
        locale={locale}
        error={amountErrorReason ? t(AMOUNT_ERROR_KEY[amountErrorReason]) : undefined}
        disabled={disabled}
        placeholder="0"
        ref={amountInputRef}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-fg-tertiary">{t('form.dateLabel')}</span>
        <DateChipPicker
          value={fecha}
          onChange={onFechaChange}
          firstDayOfWeek={firstDayOfWeek}
          locale={locale}
          dateFnsLocale={dateFnsLocale}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-fg-tertiary">{t('form.categoryLabel')}</span>
        <CategoryPicker
          categorias={categorias}
          tipo={tipo}
          selectedId={categoriaId}
          onSelect={onSelectCategoria}
          onCreateRequested={(query) => setCreateCategory({ open: true, initialName: query })}
        />
        {categoriaMissing && (
          <p role="alert" className="text-sm text-destructive">
            {t('form.categoryError')}
          </p>
        )}
      </div>

      <TextField
        label={t('form.noteLabel')}
        value={nota}
        onChange={onNotaChange}
        placeholder={t('form.notePlaceholder')}
        disabled={disabled}
      />

      <CategoryFormModal
        open={createCategory.open}
        onClose={() => setCreateCategory({ open: false })}
        tipo={tipo}
        secciones={secciones}
        categorias={categorias}
        initialName={createCategory.initialName}
      />
    </div>
  )
}
