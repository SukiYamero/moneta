import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria, TipoMovimiento } from '@/lib/schema'
import { TagChip } from '@/components/shared/TagChip'
import { TextField } from '@/components/shared/TextField'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { matchesQuery } from '@/features/search/searchMatch'

export interface CategoryPickerProps {
  /** Every category, archived or not — the picker filters `archivado` itself, so every caller shares one rule. */
  categorias: Categoria[]
  /** The sheet's current type — orders matching categories first (specs.md §10.22 Decision 3), never filters and never flips this on selection. */
  tipo: TipoMovimiento
  selectedId?: string
  onSelect: (categoria: Categoria) => void
  /** The typed query, once the user taps "crear «query»" — the caller opens `CategoryFormModal` pre-filled with it. */
  onCreateRequested: (query: string) => void
}

/**
 * Non-archived categories, matching `tipo` first — a stable partition
 * (`Array#filter` preserves relative order), never a resort that could
 * reshuffle categories sharing a type. `Categoria.tipo` is a default, not a
 * constraint (specs.md §10.22 Decision 3): nothing is hidden, a category
 * legitimately used both ways stays reachable.
 */
const orderForPicker = (categorias: Categoria[], tipo: TipoMovimiento): Categoria[] => {
  const active = categorias.filter((c) => !c.archivado)
  const matching = active.filter((c) => c.tipo === tipo)
  const rest = active.filter((c) => c.tipo !== tipo)
  return [...matching, ...rest]
}

/**
 * Rendered inline inside a sheet (Add/Edit movement, reusable by the Filter
 * sheet) — never its own overlay. Single-select: `onSelect` sets both
 * `categoria`/`seccionId` at the call site (`seccion` is derived, never
 * picked — specs.md §10.22).
 */
export const CategoryPicker = ({
  categorias,
  tipo,
  selectedId,
  onSelect,
  onCreateRequested,
}: CategoryPickerProps) => {
  const { t } = useTranslation('tags')
  const [query, setQuery] = useState('')

  const ordered = useMemo(() => orderForPicker(categorias, tipo), [categorias, tipo])
  const trimmedQuery = query.trim()
  const filtered = useMemo(
    () => (trimmedQuery ? ordered.filter((c) => matchesQuery(trimmedQuery, c.nombre)) : ordered),
    [ordered, trimmedQuery],
  )
  const showCreateOption = trimmedQuery.length > 0 && filtered.length === 0

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label={t('picker.searchLabel')}
        value={query}
        onChange={setQuery}
        placeholder={t('picker.searchPlaceholder')}
      />
      {/* Wraps, never its own horizontal scroll — the sheet it's mounted
          inside is the scroll container for vertical overflow. */}
      <div className="flex flex-wrap gap-2">
        {filtered.map((c) => {
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
        {showCreateOption && (
          <TagChip
            icon={Plus}
            tint="neutral"
            label={t('picker.createOption', { query: trimmedQuery })}
            onClick={() => onCreateRequested(trimmedQuery)}
          />
        )}
      </div>
    </div>
  )
}
