import { useMemo, useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria, TipoMovimiento } from '@/lib/schema'
import { TagChip } from '@/components/shared/TagChip'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { orderForPicker } from '@/features/tags/categoryOrder'
import { TagPickerSheet } from '@/features/tags/TagPickerSheet'

export interface CategoryPickerProps {
  categorias: Categoria[]
  tipo: TipoMovimiento
  selectedId?: string
  onSelect: (categoria: Categoria) => void
  onCreateRequested: (query: string) => void
}

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
