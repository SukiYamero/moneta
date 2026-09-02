import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAvatar, type IconAvatarTint } from '@/components/shared/IconAvatar'
import { i18next } from '@/lib/i18n'
import type { ToastItem, ToastVariant } from '@/lib/toastStore'

export interface ToastProps {
  item: ToastItem
  onDismiss: () => void
}

const SWIPE_DISMISS_THRESHOLD_PX = 80
const SWIPE_OPACITY_FLOOR = 0.3
const SWIPE_OPACITY_RANGE_PX = 200

const VARIANT_ICON = {
  success: CircleCheck,
  error: CircleAlert,
} as const

const VARIANT_TINT: Record<ToastVariant, IconAvatarTint> = {
  success: 'success',
  error: 'danger',
}

export const Toast = ({ item, onDismiss }: ToastProps) => {
  const { t } = useTranslation('toast')
  const cardRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef(0)
  const draggingRef = useRef(false)
  const dragStartX = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  const Icon = VARIANT_ICON[item.variant]

  const applyDragStyle = (offset: number) => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = offset ? `translateX(${offset}px)` : ''
    card.style.opacity = String(
      Math.max(SWIPE_OPACITY_FLOOR, 1 - Math.abs(offset) / SWIPE_OPACITY_RANGE_PX),
    )
  }

  const resetCardStyle = () => {
    const card = cardRef.current
    if (!card) return
    card.style.transitionDuration = ''
    card.style.transform = ''
    card.style.opacity = ''
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartX.current = event.clientX
    pointerIdRef.current = event.pointerId
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (cardRef.current) cardRef.current.style.transitionDuration = '0ms'
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const offset = event.clientX - dragStartX.current
    dragOffsetRef.current = offset
    applyDragStyle(offset)
  }

  const releaseCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current === null) return
    if (event.currentTarget.hasPointerCapture?.(pointerIdRef.current)) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current)
    }
    pointerIdRef.current = null
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    releaseCapture(event)
    if (!draggingRef.current) return
    draggingRef.current = false
    const offset = dragOffsetRef.current
    dragOffsetRef.current = 0
    if (Math.abs(offset) > SWIPE_DISMISS_THRESHOLD_PX) {
      onDismiss()
      return
    }
    resetCardStyle()
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    releaseCapture(event)
    draggingRef.current = false
    dragOffsetRef.current = 0
    resetCardStyle()
  }

  const handleLostPointerCapture = () => {
    pointerIdRef.current = null
    if (!draggingRef.current) return
    draggingRef.current = false
    dragOffsetRef.current = 0
    resetCardStyle()
  }

  return (
    <div
      ref={cardRef}
      role={item.variant === 'error' ? 'alert' : 'status'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={handleLostPointerCapture}
      className="pointer-events-auto flex w-full max-w-[26rem] touch-pan-y items-center gap-3 rounded-2xl border border-border-subtle bg-card px-4 py-3 transition-transform duration-200 ease-out animate-pop-in"
    >
      <IconAvatar icon={Icon} tint={VARIANT_TINT[item.variant]} size="sm" />
      <p className="min-w-0 flex-1 text-sm font-medium break-words">
        {item.message}
        {item.count > 1 && (
          <span className="ml-1.5 text-fg-tertiary">
            {t('repeatSuffix', { count: item.count })}
          </span>
        )}
      </p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onAction()
            onDismiss()
          }}
          className="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-primary"
        >
          {i18next.t(item.action.labelKey)}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismiss')}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-fg-tertiary"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
