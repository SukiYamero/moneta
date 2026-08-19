import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useOverlay } from '@/components/shared/useOverlay'

type BottomSheetLabelProps =
  | { labelledBy: string; ariaLabel?: never }
  | { ariaLabel: string; labelledBy?: never }

export type BottomSheetProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
} & BottomSheetLabelProps

const DRAG_DISMISS_THRESHOLD_PX = 120

/**
 * The sliding-sheet shell (Filter, Movement, Profile, Add, Tag picker…).
 * Drag-to-dismiss is driven by Pointer Events (one path for touch/mouse/pen)
 * with `touch-none` on the handle so the browser doesn't fight the gesture.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
}: BottomSheetProps) {
  const panelRef = useOverlay<HTMLDivElement>({ open, onClose })
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(0)

  if (!open) return null

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragY(Math.max(0, event.clientY - dragStartY.current))
  }

  const endDrag = () => {
    if (!dragging) return
    setDragging(false)
    if (dragY > DRAG_DISMISS_THRESHOLD_PX) onClose()
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
          'absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-5xl border-t border-border-subtle bg-card px-[22px] pt-2.5 pb-7 animate-sheet-up transition-transform duration-200 ease-out',
          className,
        )}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="mx-auto mb-[18px] flex h-8 w-full touch-none cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <div className="h-[5px] w-[38px] rounded-full bg-border-strong" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
