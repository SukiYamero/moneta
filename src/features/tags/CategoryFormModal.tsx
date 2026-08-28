import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Categoria } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CenterModal } from '@/components/shared/CenterModal'
import { TextField } from '@/components/shared/TextField'
import { TagChip } from '@/components/shared/TagChip'
import { PagedGrid } from '@/components/shared/PagedGrid'
import { TINT_CLASSES, ICON_AVATAR_TINTS } from '@/components/shared/tintClasses'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { normalizeForSearch } from '@/features/search/searchMatch'
import { CATEGORY_ICONS, type CategoryIconKey } from '@/components/shared/categoryIcons'
import { rankCategoryIcons, suggestCategoryVisual } from '@/features/tags/categorySuggest'

export interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  categorias: Categoria[]
  categoria?: Categoria
  initialName?: string
  padreId?: string
  onCreated?: (categoria: Categoria) => void
}

const ICON_GRID_COLUMNS = 5
const ICON_GRID_ROWS = 4

const sameOrder = <T,>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index])

const MAX_NAME_LENGTH = 30

const COLOR_NAME_KEY = {
  emerald: 'colors.emerald',
  blue: 'colors.blue',
  amber: 'colors.amber',
  rose: 'colors.rose',
  purple: 'colors.purple',
  success: 'colors.success',
  danger: 'colors.danger',
  info: 'colors.info',
  neutral: 'colors.neutral',
} as const satisfies Record<IconAvatarTint, string>

export const CategoryFormModal = ({
  open,
  onClose,
  categorias,
  categoria,
  initialName,
  padreId,
  onCreated,
}: CategoryFormModalProps) => {
  const { t } = useTranslation('tags')
  const upsertCategoria = useDataStore((s) => s.upsertCategoria)
  const titleId = useId()

  const [name, setName] = useState('')
  const [icono, setIcono] = useState<CategoryIconKey | undefined>(undefined)
  const [color, setColor] = useState<IconAvatarTint>('neutral')
  const [submitting, setSubmitting] = useState(false)
  const [iconPage, setIconPage] = useState(0)

  const parent = padreId ? categorias.find((c) => c.id === padreId) : undefined

  useEffect(() => {
    if (!open) return
    if (categoria) {
      setName(categoria.nombre)
      setIcono(categoria.icono)
      setColor(categoria.color ?? 'neutral')
    } else {
      const suggestion = suggestCategoryVisual(initialName ?? '', categorias)
      setName(initialName ?? '')
      setIcono(suggestion.icono)
      setColor(parent ? (parent.color ?? 'neutral') : suggestion.color)
    }
    setIconPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const effectivePadreId = categoria ? categoria.padreId : padreId

  const trimmedName = name.trim()
  const isDuplicateName = useMemo(() => {
    if (!trimmedName) return false
    const normalized = normalizeForSearch(trimmedName)
    return categorias.some(
      (c) =>
        c.id !== categoria?.id &&
        c.padreId === effectivePadreId &&
        normalizeForSearch(c.nombre) === normalized,
    )
  }, [trimmedName, categorias, categoria, effectivePadreId])

  const canSave = trimmedName.length > 0 && !isDuplicateName

  const rankedIcons = useMemo(() => rankCategoryIcons(trimmedName), [trimmedName])
  const previousRankedIcons = useRef(rankedIcons)
  useEffect(() => {
    if (!sameOrder(previousRankedIcons.current, rankedIcons)) setIconPage(0)
    previousRankedIcons.current = rankedIcons
  }, [rankedIcons])

  const handleSave = async () => {
    if (!canSave || submitting) return
    const result: Categoria = {
      id: categoria?.id ?? crypto.randomUUID(),
      nombre: trimmedName,
      padreId: effectivePadreId,
      icono,
      color,
      archivado: categoria?.archivado,
      presupuesto: categoria?.presupuesto,
    }
    setSubmitting(true)
    try {
      const saved = await upsertCategoria(result)
      if (saved) {
        onCreated?.(result)
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const preview = getMovimientoVisual({ icono, color }, 'gasto')
  const parentVisual = parent ? getMovimientoVisual(parent, 'gasto') : undefined

  return (
    <CenterModal open={open} onClose={onClose} labelledBy={titleId} autoFocus={false}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-base font-extrabold">
            {categoria ? t('form.editTitle') : t('form.createTitle')}
          </h2>
          {parent && parentVisual && (
            <div className="flex items-center gap-1.5 text-sm text-fg-tertiary">
              <parentVisual.icon
                className={cn('size-4', TINT_CLASSES[parentVisual.tint].icon)}
                aria-hidden="true"
              />
              <span>{parent.nombre}</span>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <TagChip
            icon={preview.icon}
            tint={preview.tint}
            label={trimmedName || t('form.nameLabel')}
          />
        </div>

        <TextField
          label={t('form.nameLabel')}
          placeholder={t('form.namePlaceholder')}
          value={name}
          onChange={(value) => setName(value.slice(0, MAX_NAME_LENGTH))}
          maxLength={MAX_NAME_LENGTH}
          error={isDuplicateName ? t('form.nameDuplicateError') : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">{t('form.iconLabel')}</span>
          <PagedGrid
            items={rankedIcons}
            columns={ICON_GRID_COLUMNS}
            rows={ICON_GRID_ROWS}
            page={iconPage}
            onPageChange={setIconPage}
            ariaLabel={t('form.iconLabel')}
            itemKey={(key) => key}
            renderItem={(key) => {
              const Icon = CATEGORY_ICONS[key]
              return (
                <button
                  type="button"
                  aria-pressed={icono === key}
                  aria-label={key}
                  onClick={() => setIcono(key)}
                  className="flex size-11 items-center justify-center rounded-lg"
                >
                  <span
                    className={cn(
                      'flex size-9.5 items-center justify-center rounded-md',
                      TINT_CLASSES[color].badge,
                      icono === key && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                </button>
              )
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">{t('form.colorLabel')}</span>
          <div role="group" aria-label={t('form.colorLabel')} className="flex flex-wrap gap-2">
            {ICON_AVATAR_TINTS.map((tint) => (
              <button
                key={tint}
                type="button"
                aria-pressed={color === tint}
                aria-label={t(COLOR_NAME_KEY[tint])}
                onClick={() => setColor(tint)}
                className={cn(
                  'flex size-11 items-center justify-center rounded-full',
                  TINT_CLASSES[tint].badge,
                  color === tint && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                )}
              >
                <span
                  className={cn(
                    'size-5 rounded-full',
                    TINT_CLASSES[tint].icon.replace('text-', 'bg-'),
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="flex-1"
            onClick={onClose}
          >
            {t('form.cancelCta')}
          </Button>
          <Button
            type="button"
            size="touch"
            className="flex-1"
            disabled={!canSave || submitting}
            onClick={() => void handleSave()}
          >
            {t('form.saveCta')}
          </Button>
        </div>
      </div>
    </CenterModal>
  )
}
