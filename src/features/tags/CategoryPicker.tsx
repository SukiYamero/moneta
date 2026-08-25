import { useMemo, useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria, TipoMovimiento } from '@/lib/schema'
import { TagChip } from '@/components/shared/TagChip'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { orderForPicker } from '@/features/tags/categoryOrder'
import { TagPickerSheet } from '@/features/tags/TagPickerSheet'

export interface CategoryPickerProps {
  /** Every category, archived or not — the picker filters `archivado` itself, so every caller shares one rule. */
  categorias: Categoria[]
  /** The sheet's current type — orders matching categories first (specs.md §10.22 Decision 3), never filters and never flips this on selection. */
  tipo: TipoMovimiento
  selectedId?: string
  onSelect: (categoria: Categoria) => void
  /** The typed query, once the user taps "crear «query»" (from the full picker) or the "Custom" chip (query `''`) — the caller opens `CategoryFormModal` pre-filled with it. */
  onCreateRequested: (query: string) => void
}

/**
 * Rendered inline inside a sheet (Add/Edit movement) — never its own
 * overlay. `docs/ui/design-export-add-sheet.md` §1/§2: a fixed left column
 * (a count button opening the full searchable `TagPickerSheet`, plus a
 * dashed "Custom" chip) beside a horizontally-scrolling 2-row carousel of
 * the same categories, ordered per specs.md §10.22 Decision 3. Search moved
 * out of this inline surface into `TagPickerSheet` (specs.md §10.41) —
 * this component no longer renders a search box itself.
 *
 * Single-select: `onSelect` sets both `categoria`/`seccionId` at the call
 * site (`seccion` is derived, never picked — specs.md §10.22).
 */
export const CategoryPicker = ({
  categorias,
  tipo,
  selectedId,
  onSelect,
  onCreateRequested,
}: CategoryPickerProps) => {
  const { t } = useTranslation('tags')
  const [pickerOpen, setPickerOpen] = useState(false)

  const ordered = useMemo(() => orderForPicker(categorias, tipo), [categorias, tipo])
  const activeCount = ordered.length

  return (
    <div className="flex gap-2">
      <div className="grid flex-none grid-rows-2 gap-1.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={t('picker.openAllAria', { count: activeCount })}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-surface-sunken px-3 text-ms font-bold text-fg-secondary"
        >
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          {activeCount}
        </button>
        <button
          type="button"
          onClick={() => onCreateRequested('')}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 text-ms font-semibold text-fg-tertiary"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('picker.customCta')}
        </button>
      </div>

      {/* Horizontal 2-row carousel — the sheet's own body is the vertical
          scroll container, this is the one deliberate horizontal-scroll
          surface (docs/ui/design-export-add-sheet.md §2). `touch-pan-x` +
          hidden-scrollbar utilities match `PeriodPickerRow.tsx`'s existing
          horizontal-scroll pattern rather than inventing a second one. */}
      <div className="grid min-w-0 flex-1 auto-cols-max grid-flow-col grid-rows-2 touch-pan-x gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ordered.map((c) => {
          const { icon, tint } = getMovimientoVisual(c, c.tipo)
          return (
            <TagChip
              key={c.id}
              icon={icon}
              tint={tint}
              label={c.nombre}
              selected={c.id === selectedId}
              onClick={() => onSelect(c)}
            />
          )
        })}
      </div>

      <TagPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categorias={categorias}
        tipo={tipo}
        selectedId={selectedId}
        onSelect={onSelect}
        onCreateRequested={(query) => {
          setPickerOpen(false)
          onCreateRequested(query)
        }}
      />
    </div>
  )
}
