import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Categoria } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CenterModal } from '@/components/shared/CenterModal'
import { TextField } from '@/components/shared/TextField'
import { TagChip } from '@/components/shared/TagChip'
import { IconAvatar } from '@/components/shared/IconAvatar'
import { TINT_CLASSES, ICON_AVATAR_TINTS } from '@/components/shared/tintClasses'
import { getMovimientoVisual } from '@/components/shared/movimientoView'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { normalizeForSearch } from '@/features/search/searchMatch'
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_KEYS,
  type CategoryIconKey,
} from '@/components/shared/categoryIcons'
import { suggestCategoryVisual } from '@/features/tags/categorySuggest'

export interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  categorias: Categoria[]
  categoria?: Categoria
  initialName?: string
}

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
}: CategoryFormModalProps) => {
  const { t } = useTranslation('tags')
  const upsertCategoria = useDataStore((s) => s.upsertCategoria)
  const titleId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [icono, setIcono] = useState<CategoryIconKey | undefined>(undefined)
  const [color, setColor] = useState<IconAvatarTint>('neutral')
  const [submitting, setSubmitting] = useState(false)

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
      setColor(suggestion.color)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trimmedName = name.trim()
  const isDuplicateName = useMemo(() => {
    if (!trimmedName) return false
    const normalized = normalizeForSearch(trimmedName)
    return categorias.some(
      (c) =>
        c.id !== categoria?.id &&
        c.padreId === categoria?.padreId &&
        normalizeForSearch(c.nombre) === normalized,
    )
  }, [trimmedName, categorias, categoria])

  const canSave = trimmedName.length > 0 && !isDuplicateName

  const handleSave = async () => {
    if (!canSave || submitting) return
    const result: Categoria = {
      id: categoria?.id ?? crypto.randomUUID(),
      nombre: trimmedName,
      padreId: categoria?.padreId,
      icono,
      color,
      archivado: categoria?.archivado,
      presupuesto: categoria?.presupuesto,
    }
    setSubmitting(true)
    try {
      const saved = await upsertCategoria(result)
      if (saved) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const preview = getMovimientoVisual({ icono, color }, 'gasto')

  return (
    <CenterModal open={open} onClose={onClose} labelledBy={titleId} initialFocus={nameInputRef}>
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-base font-extrabold">
          {categoria ? t('form.editTitle') : t('form.createTitle')}
        </h2>

        <div className="flex justify-center">
          <TagChip
            icon={preview.icon}
            tint={preview.tint}
            label={trimmedName || t('form.nameLabel')}
          />
        </div>

        <TextField
          ref={nameInputRef}
          label={t('form.nameLabel')}
          placeholder={t('form.namePlaceholder')}
          value={name}
          onChange={(value) => setName(value.slice(0, MAX_NAME_LENGTH))}
          maxLength={MAX_NAME_LENGTH}
          error={isDuplicateName ? t('form.nameDuplicateError') : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">{t('form.iconLabel')}</span>
          <div role="group" aria-label={t('form.iconLabel')} className="flex flex-wrap gap-2">
            {CATEGORY_ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={icono === key}
                aria-label={key}
                onClick={() => setIcono(key)}
                className={cn(
                  'rounded-lg p-0.5',
                  icono === key && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                )}
              >
                <IconAvatar icon={CATEGORY_ICONS[key]} tint={color} />
              </button>
            ))}
          </div>
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
