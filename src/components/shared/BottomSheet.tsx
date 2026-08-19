import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'

export type BottomSheetProps = OverlayShellProps<HTMLDivElement>

const DRAG_DISMISS_THRESHOLD_PX = 120

/**
 * The sliding-sheet shell (Filter, Movement, Profile, Add, Tag picker…).
 * Drag-to-dismiss is driven by Pointer Events (one path for touch/mouse/pen)
 * with `touch-none` on the handle so the browser doesn't fight the gesture.
 */
export const BottomSheet = ({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
  initialFocus,
  ref,
}: BottomSheetProps) => {
  const panelRef = useOverlay<HTMLDivElement>({ open, onClose, initialFocus, ref })
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  if (!open) return null

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY
    pointerIdRef.current = event.pointerId
    setDragging(true)
    // Pointer capture keeps move/up events targeting this handle even once
    // the pointer strays outside it (or the window) mid-drag. Guarded
    // because jsdom (and some minimal WebViews) don't implement it.
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

  // A cancelled gesture (system gesture, multi-touch conflict, pointer
  // capture lost outright) never counts as user intent to dismiss — only
  // reset the drag state, don't check the threshold.
  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    releaseCapture(event)
    setDragging(false)
    setDragY(0)
  }

  // `lostpointercapture` is the reliable catch-all for a drag that ends
  // outside the window (the OS never delivers pointerup/pointercancel back
  // to the page in that case) — it always fires once capture is released,
  // including right after a normal pointerup, where `dragging` is already
  // false and this is a harmless no-op.
  const handleLostPointerCapture = () => {
    pointerIdRef.current = null
    if (!dragging) return
    setDragging(false)
    setDragY(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/55"
        aria-hidden="true"
      />
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
          'absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-5xl border-t border-border-subtle bg-card px-5.5 pt-2.5 pb-7 animate-sheet-up transition-transform duration-200 ease-out',
          OVERLAY_PANEL_CLASS,
          className,
        )}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={handleLostPointerCapture}
          className="mx-auto mb-4.5 flex h-8 w-full touch-none cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <div className="h-1.25 w-9.5 rounded-full bg-border-strong" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
