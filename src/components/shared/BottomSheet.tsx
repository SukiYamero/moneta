import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { createVelocityTracker, prefersReducedMotion, shouldCommitSwipe } from '@/lib/gesture'
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
const DRAG_DISMISS_VELOCITY_PX_MS = 0.6
const EXIT_DURATION_MS = 200

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
  const setOverlayRef = useOverlay<HTMLDivElement>({ open, onClose, initialFocus, autoFocus, ref })
  const { backdropRef, onClick: handleBackdropClick } = useBackdropDismiss<HTMLDivElement>(
    open,
    onClose,
  )
  const panelRef = useRef<HTMLDivElement | null>(null)
  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node
      setOverlayRef(node)
    },
    [setOverlayRef],
  )
  const dragOffsetRef = useRef(0)
  const draggingRef = useRef(false)
  const dragStartY = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const velocityTracker = useRef(createVelocityTracker())

  const resetPanelStyle = () => {
    const panel = panelRef.current
    if (!panel) return
    panel.style.transitionDuration = ''
    panel.style.transform = ''
  }

  // Derived during render (not an effect) so the open->closing transition lands in the
  // same commit as the prop change.
  const [phase, setPhase] = useState<'open' | 'closing' | 'closed'>(open ? 'open' : 'closed')
  const prevOpenRef = useRef(open)
  if (prevOpenRef.current !== open) {
    prevOpenRef.current = open
    if (open) {
      // A reopen while still mid-exit-animation must clear the closing effect's leftover
      // off-screen transform — otherwise the panel renders "open" but stuck off-screen.
      resetPanelStyle()
      setPhase('open')
    } else if (phase !== 'closed') {
      // React's own commit restores focus to whatever was active before this
      // update if that element is still connected — blurring it first, before
      // the panel it lives in stays mounted through the exit animation, is
      // what lets useOverlay's own trigger-focus restoration actually stick.
      const panel = panelRef.current
      if (panel?.contains(document.activeElement)) {
        ;(document.activeElement as HTMLElement).blur()
      }
      setPhase('closing')
    }
  }

  // Continues the panel from wherever the drag/rest position left it to fully off-screen.
  useLayoutEffect(() => {
    if (phase !== 'closing') return
    const panel = panelRef.current
    if (!panel) return
    const target = panel.offsetHeight
    panel.style.transitionDuration = ''
    panel.style.transform = target ? `translateY(${target}px)` : ''
  }, [phase])

  useEffect(() => {
    if (phase !== 'closing') return
    const timer = setTimeout(
      () => setPhase('closed'),
      prefersReducedMotion() ? 0 : EXIT_DURATION_MS,
    )
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'closed') return null

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return
    dragStartY.current = event.clientY
    pointerIdRef.current = event.pointerId
    draggingRef.current = true
    velocityTracker.current.reset()
    velocityTracker.current.record(event.clientY, event.timeStamp)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (panelRef.current) panelRef.current.style.transitionDuration = '0ms'
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    if (!draggingRef.current) return
    velocityTracker.current.record(event.clientY, event.timeStamp)
    const offset = Math.max(0, event.clientY - dragStartY.current)
    dragOffsetRef.current = offset
    if (panelRef.current) {
      panelRef.current.style.transform = offset ? `translateY(${offset}px)` : ''
    }
  }

  const releaseCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current === null) return
    if (event.currentTarget.hasPointerCapture?.(pointerIdRef.current)) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current)
    }
    pointerIdRef.current = null
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    releaseCapture(event)
    if (!draggingRef.current) return
    draggingRef.current = false
    const offset = dragOffsetRef.current
    dragOffsetRef.current = 0
    const commit = shouldCommitSwipe({
      distance: offset,
      // Only a downward flick counts — an upward one that never reversed the clamped
      // offset should never read as dismiss intent.
      velocity: Math.max(0, velocityTracker.current.velocity(event.timeStamp)),
      distanceThreshold: DRAG_DISMISS_THRESHOLD_PX,
      velocityThreshold: DRAG_DISMISS_VELOCITY_PX_MS,
    })
    if (commit) {
      onClose()
      return
    }
    resetPanelStyle()
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    releaseCapture(event)
    draggingRef.current = false
    dragOffsetRef.current = 0
    resetPanelStyle()
  }

  // The only event guaranteed to fire when a drag ends outside the window —
  // the OS delivers no pointerup/pointercancel back to the page in that case.
  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    if (!draggingRef.current) return
    draggingRef.current = false
    dragOffsetRef.current = 0
    resetPanelStyle()
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
          ref={setPanelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={ariaLabel}
          tabIndex={-1}
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
