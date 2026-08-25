import { useEffect, useRef, useState, type Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Locale } from 'date-fns'
import type { Categoria, Moneda, Seccion, TipoMovimiento } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import { TextField } from '@/components/shared/TextField'
import { FOCUSABLE_SELECTOR } from '@/components/shared/useOverlay'
import { CategoryPicker, CategoryFormModal } from '@/features/tags'
import { MovimientoAmountInput } from '@/features/movimientos/MovimientoAmountInput'
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
  /** Increments on every submit tap, blocked or not (`useMovimientoForm`'s `submitAttempts`) — drives bringing whichever field blocked the save on screen, since `amountErrorReason`/`categoriaMissing` alone don't change on a repeated tap in the same invalid state. */
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

const NOTE_MAX_LENGTH = 40

/**
 * The field set shared by the create sheet and the edit form (specs.md
 * §10.23 Decision 1, §10.41) — presentational, driven entirely by
 * `useMovimientoForm`'s return value. Field order and layout follow
 * `docs/ui/design-export-add-sheet.md` §2: type toggle, a centered date
 * chip, the centered amount display, categories (fixed column + carousel),
 * then the note field behind a "ver más" disclosure. The only local state
 * this owns is that disclosure's open flag and the "create category from
 * query" modal's open/prefill — both UI concerns, not form validation.
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

  // A blocked submit (item 3, docs/ajustes-3-plan.md §2/§4) previously left
  // its only feedback wherever the field it belongs to happens to sit —
  // fine on a screen with no keyboard up, invisible on a phone where the
  // focused amount field's software keyboard covers everything below it.
  // Keyed on `submitAttempts` (not `amountErrorReason`/`categoriaMissing`
  // themselves), which changes on every tap including a repeated one that
  // hits the same already-invalid state — those two flags wouldn't.
  //
  // Moves focus to the control that actually blocked the save (the amount
  // input, or the category section's first focusable control), rather than
  // an earlier version that blurred whatever held focus unconditionally
  // (specs.md §10.51): tapping/Tab-and-Enter-ing the submit button leaves
  // *it* as `document.activeElement` in every browser that focuses a
  // clicked/activated button (Chrome, keyboard-driven Safari) — blurring
  // that dropped a keyboard user's focus to `<body>` with no way back short
  // of tabbing from the top of the document. Focusing the real target
  // fixes that directly, and still dismisses an iOS software keyboard as a
  // side effect whenever the target isn't the already-focused amount input
  // (moving focus off a text input closes the keyboard on its own — no
  // explicit `blur()` needed for that). When the amount itself is invalid,
  // this refocuses the amount input, which is exactly where an iOS user
  // still needs to type — AJ3-B's viewport fix (specs.md §10.49) keeps it
  // visible above the keyboard rather than fighting to dismiss it.
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
          <TextField
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
