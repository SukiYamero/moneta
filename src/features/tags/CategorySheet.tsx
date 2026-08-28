import { useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Plus, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { PagedGrid } from '@/components/shared/PagedGrid'
import { TINT_CLASSES } from '@/components/shared/tintClasses'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { matchesQuery } from '@/features/search/searchMatch'
import { CategoryFormModal } from '@/features/tags/CategoryFormModal'

export interface CategorySheetProps {
  open: boolean
  onClose: () => void
  categorias: Categoria[]
  selectedId?: string
  onSelect: (categoria: Categoria) => void
}

type GridItem = { kind: 'custom' } | { kind: 'category'; categoria: Categoria; general?: boolean }

const GRID_COLUMNS = 3
const GRID_ROWS = 3

const isTopLevel = (categoria: Categoria, liveIds: ReadonlySet<string>): boolean =>
  categoria.padreId === undefined || !liveIds.has(categoria.padreId)

export const CategorySheet = ({
  open,
  onClose,
  categorias,
  selectedId,
  onSelect,
}: CategorySheetProps) => {
  const { t } = useTranslation('tags')
  const titleId = useId()
  const searchId = useId()

  const [parent, setParent] = useState<Categoria | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const level1PageRef = useRef(0)
  const wasOpenRef = useRef(open)

  if (open && !wasOpenRef.current) {
    setParent(undefined)
    setQuery('')
    setPage(0)
    setCreateOpen(false)
  }
  wasOpenRef.current = open

  const nonArchived = useMemo(() => categorias.filter((c) => !c.archivado), [categorias])
  const idSet = useMemo(() => new Set(nonArchived.map((c) => c.id)), [nonArchived])

  const topLevel = useMemo(
    () => nonArchived.filter((c) => isTopLevel(c, idSet)),
    [nonArchived, idSet],
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Categoria[]>()
    for (const c of nonArchived) {
      if (isTopLevel(c, idSet)) continue
      const siblings = map.get(c.padreId!) ?? []
      siblings.push(c)
      map.set(c.padreId!, siblings)
    }
    return map
  }, [nonArchived, idSet])

  const trimmedQuery = query.trim()
  const isSearching = trimmedQuery.length > 0

  const searchResults = useMemo(
    () => (isSearching ? nonArchived.filter((c) => matchesQuery(trimmedQuery, c.nombre)) : []),
    [nonArchived, trimmedQuery, isSearching],
  )

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setPage(0)
    if (value.trim()) setParent(undefined)
  }

  const handleSelect = (categoria: Categoria) => {
    onSelect(categoria)
    onClose()
  }

  const handleDrillIn = (categoria: Categoria) => {
    level1PageRef.current = page
    setParent(categoria)
    setPage(0)
  }

  const handleBack = () => {
    setParent(undefined)
    setPage(level1PageRef.current)
  }

  const handleCustomTap = () => setCreateOpen(true)

  const level1Items: GridItem[] = useMemo(
    () => [
      { kind: 'custom' },
      ...topLevel.map((categoria): GridItem => ({ kind: 'category', categoria })),
    ],
    [topLevel],
  )

  const level2Items: GridItem[] = useMemo(() => {
    if (!parent) return []
    const children = childrenByParent.get(parent.id) ?? []
    return [
      { kind: 'category', categoria: parent, general: true },
      { kind: 'custom' },
      ...children.map((categoria): GridItem => ({ kind: 'category', categoria })),
    ]
  }, [parent, childrenByParent])

  const searchItems: GridItem[] = useMemo(
    () => searchResults.map((categoria): GridItem => ({ kind: 'category', categoria })),
    [searchResults],
  )

  const items = isSearching ? searchItems : parent ? level2Items : level1Items

  const renderTile = (item: GridItem) => {
    if (item.kind === 'custom') {
      return (
        <button
          type="button"
          onClick={handleCustomTap}
          className="flex h-full w-full items-center justify-center"
        >
          <span className="flex h-4/5 w-4/5 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-1.5 py-2.5 text-fg-tertiary">
            <Plus className="size-4" aria-hidden="true" />
            <span className="line-clamp-2 text-center text-xs font-bold">
              {t('sheet.customCta')}
            </span>
          </span>
        </button>
      )
    }

    const { categoria, general } = item
    const { icon: Icon, tint } = getMovimientoVisual(categoria, 'gasto')
    const selected = categoria.id === selectedId
    const hasChildren =
      !isSearching && !parent && (childrenByParent.get(categoria.id)?.length ?? 0) > 0

    return (
      <button
        type="button"
        onClick={() => (hasChildren ? handleDrillIn(categoria) : handleSelect(categoria))}
        aria-pressed={selected}
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center"
      >
        <span
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-lg px-2 py-1.5',
            general && 'bg-surface-sunken',
            selected && 'ring-2 ring-primary',
          )}
        >
          <span
            className={cn(
              'flex size-10.5 shrink-0 items-center justify-center rounded-md',
              TINT_CLASSES[tint].badge,
            )}
          >
            <Icon className="size-5.5" aria-hidden="true" />
          </span>
          <span className="line-clamp-2 text-xs font-bold">{categoria.nombre}</span>
        </span>
      </button>
    )
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} labelledBy={titleId} autoFocus={false}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            {parent && (
              <button
                type="button"
                onClick={handleBack}
                aria-label={t('sheet.backAria')}
                className="flex size-11 shrink-0 items-center justify-center"
              >
                <span className="flex size-8 items-center justify-center rounded-sm bg-muted">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </span>
              </button>
            )}
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-xl font-extrabold">
              {parent ? parent.nombre : t('sheet.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('sheet.closeAria')}
              className="flex size-11 shrink-0 items-center justify-center"
            >
              <span className="flex size-8 items-center justify-center rounded-sm bg-muted">
                <X className="size-4" aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-3.5 size-4 text-fg-faint"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={t('sheet.searchPlaceholder')}
              aria-label={t('sheet.searchLabel')}
              className="h-11 rounded-lg border-border-subtle bg-surface-sunken pl-10 text-sm font-semibold"
            />
          </div>

          <PagedGrid
            items={items}
            columns={GRID_COLUMNS}
            rows={GRID_ROWS}
            page={page}
            onPageChange={setPage}
            renderItem={renderTile}
            itemKey={(item) => (item.kind === 'custom' ? 'custom' : item.categoria.id)}
            ariaLabel={t('sheet.gridAria')}
          />

          {isSearching && searchResults.length === 0 && (
            <button
              type="button"
              onClick={handleCustomTap}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/8 px-4 text-sm font-bold text-primary"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('sheet.createOption', { query: trimmedQuery })}
            </button>
          )}
        </div>
      </BottomSheet>

      <CategoryFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categorias={categorias}
        initialName={trimmedQuery || undefined}
        padreId={parent?.id}
        onCreated={handleSelect}
      />
    </>
  )
}
