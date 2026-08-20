import { useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Categoria, Seccion, TipoMovimiento } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import { IconAvatar } from '@/components/shared/IconAvatar'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
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
  const { icon, tint } = getMovimientoVisual(categoria, categoria.tipo)
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

/**
 * `Config.categorias`, grouped by `Seccion` per specs.md §10.24. Tapping a
 * row opens `CategoryFormModal` in edit mode — the reused §10.22 editor,
 * never a second one.
 *
 * Archive/restore/delete follow §10.22 Decision 5, deliberately routed so
 * the destructive action is never the only option and never a dead one:
 * - **Active rows only ever offer Archive** — always safe
 *   (`dataStore.archiveCategoria` self-refuses via a toast if it would
 *   leave the picker empty), always one tap. This *is* "the archive path
 *   offered instead of a bare no" (§10.24's edge case): archiving an active,
 *   in-use category is never gated behind an attempted-and-refused delete.
 * - **Archived rows offer Delete only when this screen can already see the
 *   category has no referencing movement** (checked against `movimientos`,
 *   the same rule `dataStore.deleteCategoria` enforces server-side — this
 *   is a UI-level pre-check, not a second policy). A still-referenced
 *   archived category shows a plain note instead of a button that would
 *   always fail — the same "an inert control beats a dead one" rule
 *   `PreferencesSection`'s theme row already follows, reusing G1's own
 *   `tags:errors.categoryInUse` copy rather than minting a duplicate.
 */
export const CategoriesSection = () => {
  const { t } = useTranslation(['settings', 'tags'])
  const secciones = useDataStore((s) => s.config?.secciones ?? [])
  const categorias = useDataStore((s) => s.config?.categorias ?? [])
  const movimientos = useDataStore((s) => s.movimientos)
  const archiveCategoria = useDataStore((s) => s.archiveCategoria)
  const upsertCategoria = useDataStore((s) => s.upsertCategoria)
  const deleteCategoria = useDataStore((s) => s.deleteCategoria)

  const [editing, setEditing] = useState<Categoria | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [createTipo, setCreateTipo] = useState<TipoMovimiento>('gasto')
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Categoria | undefined>(undefined)

  const modalOpen = creating || editing !== undefined
  const closeModal = () => {
    setCreating(false)
    setEditing(undefined)
  }

  const isInUse = (categoria: Categoria) => movimientos.some((m) => m.categoria === categoria.id)

  const active = categorias.filter((c) => !c.archivado)
  const archived = categorias.filter((c) => c.archivado)
  const sortedSecciones = secciones.toSorted((a: Seccion, b: Seccion) => a.orden - b.orden)

  const typeOptions: SegmentedControlOption<TipoMovimiento>[] = [
    { value: 'gasto', label: t('settings:categories.type.gasto') },
    { value: 'ingreso', label: t('settings:categories.type.ingreso') },
  ]

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
          {sortedSecciones.map((seccion) => {
            const rows = active.filter((c) => c.seccionId === seccion.id)
            if (rows.length === 0) return null
            return (
              <div key={seccion.id} className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-fg-tertiary">{seccion.nombre}</span>
                <div className="flex flex-col gap-1.5">
                  {rows.map((categoria) => (
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
                  ))}
                </div>
              </div>
            )
          })}

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
        <SegmentedControl
          options={typeOptions}
          value={createTipo}
          onChange={setCreateTipo}
          aria-label={t('settings:categories.newTypeLabel')}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="touch" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('settings:categories.newCta')}
        </Button>
      </div>

      <CategoryFormModal
        open={modalOpen}
        onClose={closeModal}
        tipo={createTipo}
        secciones={secciones}
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
      />
    </section>
  )
}
