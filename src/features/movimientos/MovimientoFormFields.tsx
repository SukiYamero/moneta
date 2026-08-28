import { useEffect, useRef, useState, type Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Locale } from 'date-fns'
import type { Categoria, Moneda, Seccion, TipoMovimiento } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import { TextAreaField } from '@/components/shared/TextAreaField'
import { FOCUSABLE_SELECTOR } from '@/components/shared/useOverlay'
import { CategoryPicker, CategoryFormModal } from '@/features/tags'
import { MovimientoAmountInput } from '@/features/movimientos/MovimientoAmountInput'
import type { AmountErrorReason } from '@/features/movimientos/useMovimientoForm'

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
  submitAttempts: number
  moneda: Moneda
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

const NOTE_MAX_LENGTH = 180

export const MovimientoFormFields = ({
  tipo,
  onTipoChange,
  amountRaw,
  onAmountChange,
  amountErrorReason,
  amountInputRef,
  submitAttempts,
  moneda,
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
  const [showMore, setShowMore] = useState(false)
  const amountSectionRef = useRef<HTMLDivElement>(null)
  const categorySectionRef = useRef<HTMLDivElement>(null)

  // A clicked button becomes document.activeElement, and moving focus off a
  // text input dismisses the iOS software keyboard without an explicit blur().
  useEffect(() => {
    if (submitAttempts === 0) return
    const target = amountErrorReason
      ? amountSectionRef.current
      : categoriaMissing
        ? categorySectionRef.current
        : null
    if (!target) return
    target.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
    target.scrollIntoView?.({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitAttempts])

  const typeOptions: SegmentedControlOption<TipoMovimiento>[] = [
    { value: 'gasto', label: t('form.type.gasto') },
    { value: 'ingreso', label: t('form.type.ingreso') },
  ]

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        options={typeOptions}
        value={tipo}
        onChange={onTipoChange}
        aria-label={t('form.typeAriaLabel')}
      />

      <div className="flex justify-center">
        <DateChipPicker
          value={fecha}
          onChange={onFechaChange}
          firstDayOfWeek={firstDayOfWeek}
          locale={locale}
          dateFnsLocale={dateFnsLocale}
        />
      </div>

      <div ref={amountSectionRef}>
        <MovimientoAmountInput
          value={amountRaw}
          onChange={onAmountChange}
          locale={locale}
          moneda={moneda}
          tipo={tipo}
          error={amountErrorReason ? t(AMOUNT_ERROR_KEY[amountErrorReason]) : undefined}
          disabled={disabled}
          ref={amountInputRef}
        />
      </div>

      <div ref={categorySectionRef} className="flex flex-col gap-1.5">
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

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex min-h-11 items-center gap-1.5 px-3 text-ms font-bold text-fg-tertiary"
        >
          {t(showMore ? 'form.showLessCta' : 'form.showMoreCta')}
          <ChevronDown
            className={cn('size-3 transition-transform', showMore && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        {showMore && (
          <TextAreaField
            label={t('form.noteLabel')}
            value={nota}
            onChange={onNotaChange}
            placeholder={t('form.notePlaceholder')}
            maxLength={NOTE_MAX_LENGTH}
            disabled={disabled}
            containerClassName="w-full"
          />
        )}
      </div>

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
