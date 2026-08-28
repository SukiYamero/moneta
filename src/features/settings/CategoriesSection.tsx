import { useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { IconAvatar } from '@/components/shared/IconAvatar'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { CategoryFormModal } from '@/features/tags/CategoryFormModal'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

const CategoryRow = ({
  categoria,
  onEdit,
  trailing,
}: {
  categoria: Categoria
  onEdit: () => void
  trailing: ReactNode
}) => {
  const { icon, tint } = getMovimientoVisual(categoria, 'gasto')
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border-subtle bg-card px-3 py-2">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3">
        <IconAvatar icon={icon} tint={tint} size="sm" />
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
          {categoria.nombre}
        </span>
      </button>
      {trailing}
    </div>
  )
}

export const CategoriesSection = () => {
  const { t } = useTranslation(['settings', 'tags'])
  const categorias = useDataStore((s) => s.config?.categorias ?? [])
  const movimientos = useDataStore((s) => s.movimientos)
  const archiveCategoria = useDataStore((s) => s.archiveCategoria)
  const upsertCategoria = useDataStore((s) => s.upsertCategoria)
  const deleteCategoria = useDataStore((s) => s.deleteCategoria)

  const [editing, setEditing] = useState<Categoria | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Categoria | undefined>(undefined)

  const modalOpen = creating || editing !== undefined
  const closeModal = () => {
    setCreating(false)
    setEditing(undefined)
  }

  const isInUse = (categoria: Categoria) => movimientos.some((m) => m.categoria === categoria.id)

  const renderActiveRow = (categoria: Categoria) => (
    <CategoryRow
      key={categoria.id}
      categoria={categoria}
      onEdit={() => setEditing(categoria)}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          aria-label={t('settings:categories.archiveCta')}
          onClick={() => void archiveCategoria(categoria.id)}
        >
          <Archive className="size-4" aria-hidden="true" />
        </Button>
      }
    />
  )

  const active = categorias.filter((c) => !c.archivado)
  const archived = categorias.filter((c) => c.archivado)

  const activeParentIds = new Set(active.filter((c) => !c.padreId).map((c) => c.id))
  const topLevelActive = active.filter((c) => !c.padreId || !activeParentIds.has(c.padreId))
  const childrenOf = (parentId: string) => active.filter((c) => c.padreId === parentId)

  const confirmDelete = () => {
    if (!deleteTarget) return
    void deleteCategoria(deleteTarget.id)
    setDeleteTarget(undefined)
  }

  return (
    <section>
      <ProfileSectionHeading>{t('settings:categories.heading')}</ProfileSectionHeading>

      {categorias.length === 0 ? (
        <p className="text-sm text-fg-tertiary">{t('settings:categories.empty')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {topLevelActive.map((categoria) => {
              const children = childrenOf(categoria.id)
              return (
                <div key={categoria.id} className="flex flex-col gap-1.5">
                  {renderActiveRow(categoria)}
                  {children.length > 0 && (
                    <div className="ml-4 flex flex-col gap-1.5 border-l border-border-subtle pl-3">
                      {children.map((child) => renderActiveRow(child))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {archived.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setArchivedOpen((v) => !v)}
                aria-expanded={archivedOpen}
                className="flex min-h-11 items-center gap-1.5 text-xs font-bold text-fg-tertiary"
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${archivedOpen ? '' : '-rotate-90'}`}
                  aria-hidden="true"
                />
                {t('settings:categories.archivedGroup')} ({archived.length})
              </button>
              {archivedOpen && (
                <div className="flex flex-col gap-1.5">
                  {archived.map((categoria) => (
                    <CategoryRow
                      key={categoria.id}
                      categoria={categoria}
                      onEdit={() => setEditing(categoria)}
                      trailing={
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-touch"
                            aria-label={t('settings:categories.restoreCta')}
                            onClick={() => void upsertCategoria({ ...categoria, archivado: false })}
                          >
                            <ArchiveRestore className="size-4" aria-hidden="true" />
                          </Button>
                          {isInUse(categoria) ? (
                            <span className="max-w-20 text-right text-2xs font-medium text-fg-tertiary">
                              {t('tags:errors.categoryInUse')}
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-touch"
                              aria-label={t('settings:categories.deleteCta')}
                              onClick={() => setDeleteTarget(categoria)}
                            >
                              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="touch" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('settings:categories.newCta')}
        </Button>
      </div>

      <CategoryFormModal
        open={modalOpen}
        onClose={closeModal}
        categorias={categorias}
        categoria={editing}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={confirmDelete}
        title={t('settings:categories.deleteConfirm.title')}
        description={t('settings:categories.deleteConfirm.description')}
        cancelLabel={t('settings:categories.deleteConfirm.cancelCta')}
        confirmLabel={t('settings:categories.deleteConfirm.confirmCta')}
        destructive
      />
    </section>
  )
}
