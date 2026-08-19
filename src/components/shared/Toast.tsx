import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAvatar, type IconAvatarTint } from '@/components/shared/IconAvatar'
import type { ToastItem, ToastVariant } from '@/lib/toastStore'

export interface ToastProps {
  item: ToastItem
  onDismiss: () => void
}

const SWIPE_DISMISS_THRESHOLD_PX = 80

const VARIANT_ICON = {
  success: CircleCheck,
  error: CircleAlert,
} as const

const VARIANT_TINT: Record<ToastVariant, IconAvatarTint> = {
  success: 'success',
  error: 'danger',
}

/**
 * A single card in the toast stack. Notification, not a dialog — it never
 * blocks, never traps focus, never asks a question (specs.md §10.6).
 * Swipe-to-dismiss mirrors BottomSheet's drag handling: Pointer Events with
 * capture, so one code path serves touch/mouse/pen (AGENTS.md § UI).
 */
export const Toast = ({ item, onDismiss }: ToastProps) => {
  const { t } = useTranslation('toast')
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartX = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  const Icon = VARIANT_ICON[item.variant]

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartX.current = event.clientX
    pointerIdRef.current = event.pointerId
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragX(event.clientX - dragStartX.current)
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
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > SWIPE_DISMISS_THRESHOLD_PX) onDismiss()
    else setDragX(0)
  }

  // A cancelled gesture never counts as intent to dismiss — same rule as
  // BottomSheet's drag handling.
  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    releaseCapture(event)
    setDragging(false)
    setDragX(0)
  }

  const handleLostPointerCapture = () => {
    pointerIdRef.current = null
    if (!dragging) return
    setDragging(false)
    setDragX(0)
  }

  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        opacity: dragging ? Math.max(0.3, 1 - Math.abs(dragX) / 200) : undefined,
        transitionDuration: dragging ? '0ms' : undefined,
      }}
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
