import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_BACKDROP_OVERSCAN_BLOCK,
  OVERLAY_BACKDROP_OVERSCAN_INLINE,
  OVERLAY_FIXED_LAYER_OPACITY_CLASS,
  OVERLAY_PANEL_CLASS,
  useBackdropDismiss,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'

export type BottomSheetProps = OverlayShellProps<HTMLDivElement>

const DRAG_DISMISS_THRESHOLD_PX = 120

export const BottomSheet = ({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
  initialFocus,
  autoFocus,
  ref,
}: BottomSheetProps) => {
  const panelRef = useOverlay<HTMLDivElement>({ open, onClose, initialFocus, autoFocus, ref })
  const { backdropRef, onClick: handleBackdropClick } = useBackdropDismiss<HTMLDivElement>(
    open,
    onClose,
  )
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  if (!open) return null

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY
    pointerIdRef.current = event.pointerId
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragY(Math.max(0, event.clientY - dragStartY.current))
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
    if (dragY > DRAG_DISMISS_THRESHOLD_PX) onClose()
    setDragY(0)
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    releaseCapture(event)
    setDragging(false)
    setDragY(0)
  }

  // The only event guaranteed to fire when a drag ends outside the window —
  // the OS delivers no pointerup/pointercancel back to the page in that case.
  const handleLostPointerCapture = () => {
    pointerIdRef.current = null
    if (!dragging) return
    setDragging(false)
    setDragY(0)
  }

  return createPortal(
    <>
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        style={{
          top: OVERLAY_BACKDROP_OVERSCAN_BLOCK,
          bottom: OVERLAY_BACKDROP_OVERSCAN_BLOCK,
          left: OVERLAY_BACKDROP_OVERSCAN_INLINE,
          right: OVERLAY_BACKDROP_OVERSCAN_INLINE,
        }}
        className={cn('fixed z-50 animate-fade-in bg-black/55', OVERLAY_FIXED_LAYER_OPACITY_CLASS)}
        aria-hidden="true"
      />
      <div
        className={cn('pointer-events-none fixed inset-0 z-50', OVERLAY_FIXED_LAYER_OPACITY_CLASS)}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transitionDuration: dragging ? '0ms' : undefined,
          }}
          className={cn(
            'pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-5xl border-t border-border-subtle bg-card animate-sheet-up transition-transform duration-200 ease-out',
            OVERLAY_PANEL_CLASS,
            OVERLAY_FIXED_LAYER_OPACITY_CLASS,
            className,
          )}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={handleLostPointerCapture}
            className="mt-2.5 mb-4.5 flex h-8 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
          >
            <div className="h-1.25 w-9.5 rounded-full bg-border-strong" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5.5 pb-7">
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
