import { useId, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria, TipoMovimiento } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { IconAvatar } from '@/components/shared/IconAvatar'
import { TINT_CLASSES } from '@/components/shared/tintClasses'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { matchesQuery } from '@/features/search/searchMatch'
import { orderForPicker } from '@/features/tags/categoryOrder'

export interface TagPickerSheetProps {
  open: boolean
  onClose: () => void
  categorias: Categoria[]
  tipo: TipoMovimiento
  selectedId?: string
  onSelect: (categoria: Categoria) => void
  onCreateRequested: (query: string) => void
}

/**
 * The full, searchable category picker (`docs/ui/design-export-add-sheet.md`
 * §3) — opened by `CategoryPicker`'s count button. A nested `BottomSheet`:
 * `useOverlay`'s render-order stack (specs.md §10.5.1) makes it stack
 * correctly above the Add/Edit sheet regardless of DOM depth, the same
 * mechanism `MovimientoSheet`'s delete `ConfirmDialog` already relies on.
 *
 * Selecting a category closes this sheet (a picker's job is to pick one
 * thing and hand it back). Tapping "crear «query»" hands the query to the
 * caller (`CategoryPicker` closes this sheet first, then opens
 * `CategoryFormModal`) — matching the inline picker's pre-existing
 * behavior, creating never auto-selects, so the new category shows up in
 * the Add sheet's own carousel to tap afterward.
 */
export const TagPickerSheet = ({
  open,
  onClose,
  categorias,
  tipo,
  selectedId,
  onSelect,
  onCreateRequested,
}: TagPickerSheetProps) => {
  const { t } = useTranslation('tags')
  const [query, setQuery] = useState('')
  const searchId = useId()

  const ordered = useMemo(() => orderForPicker(categorias, tipo), [categorias, tipo])
  const trimmedQuery = query.trim()
  const filtered = useMemo(
    () => (trimmedQuery ? ordered.filter((c) => matchesQuery(trimmedQuery, c.nombre)) : ordered),
    [ordered, trimmedQuery],
  )
  const showCreateOption = trimmedQuery.length > 0 && filtered.length === 0

  const handleSelect = (categoria: Categoria) => {
    onSelect(categoria)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t('picker.sheetHeading')}>
      <div className="flex flex-col gap-4">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3.5 size-4 text-fg-faint"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('picker.searchPlaceholder')}
            aria-label={t('picker.searchLabel')}
            className="h-11 rounded-xl border-border-subtle bg-surface-sunken pl-10 text-sm font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {filtered.map((c) => {
            const { icon, tint } = getMovimientoVisual(c, c.tipo)
            const selected = c.id === selectedId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                aria-pressed={selected}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors',
                  selected
                    ? TINT_CLASSES[tint].pill
                    : 'border-border-subtle bg-secondary text-fg-secondary hover:border-border-hover',
                )}
              >
                <IconAvatar icon={icon} tint={tint} size="sm" />
                <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
              </button>
            )
          })}
        </div>

        {showCreateOption && (
          <button
            type="button"
            onClick={() => onCreateRequested(trimmedQuery)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/8 px-4 text-sm font-bold text-primary"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('picker.createOption', { query: trimmedQuery })}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
