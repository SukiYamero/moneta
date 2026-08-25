import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'
import {
  OVERLAY_MAX_HEIGHT_FRACTION,
  useVisualViewportInset,
} from '@/components/shared/useVisualViewportInset'

/**
 * `className` merges onto the *outer* panel (matching `CenterModal`), not
 * the scrollable body — the body owns its own horizontal/bottom padding
 * (specs.md §10.35). A caller passing `px-*`/`pb-*` today would land on the
 * wrong box; no current consumer does (verified §10.35), but a future one
 * wanting to override that padding needs a dedicated prop, not `className`.
 */
export type BottomSheetProps = OverlayShellProps<HTMLDivElement>

const DRAG_DISMISS_THRESHOLD_PX = 120

/**
 * The sliding-sheet shell (Filter, Movement, Profile, Add, Tag picker…).
 * Drag-to-dismiss is driven by Pointer Events (one path for touch/mouse/pen)
 * with `touch-none` on the handle so the browser doesn't fight the gesture.
 * The grab handle is fixed chrome — a sibling of the scrollable body, never
 * its child — so scrolling long content never carries the handle away with
 * it (specs.md §10.35).
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
  const viewportInset = useVisualViewportInset(open)
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
    <>
      {/* Always the full layout viewport, never clamped by `viewportInset`
          below — a real iPhone showed `BottomNav` (also `fixed`, sharing
          this `z-50`) through the strip a keyboard-shrunk visual viewport
          leaves outside the corrected wrapper, because this backdrop used
          to be nested *inside* that wrapper and shrank right along with it.
          Dimming the whole screen unconditionally is what a backdrop is for
          regardless of where the panel itself gets pinned (specs.md §10.49,
          cross-track review). */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 animate-fade-in bg-black/55"
        aria-hidden="true"
      />
      {/* `top`/`height` here override the `inset-0` class's top/bottom only
          while `viewportInset` is non-null (iOS panning the page, or any
          browser whose visual viewport has shrunk for the keyboard) — pinning
          the panel to the space actually visible instead of the full layout
          viewport `dvh` resolves against (specs.md §10.49). `undefined` values
          leave the class's `inset-0` in full effect, so the no-keyboard case is
          pixel-identical to before. `pointer-events-none` (with `auto`
          restored on the panel below) lets a tap that lands inside this box
          but outside the panel fall through to the backdrop above instead of
          being silently swallowed by an otherwise-invisible div. */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={viewportInset ? { top: viewportInset.top, height: viewportInset.height } : undefined}
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
            // Clamps the panel to the same corrected space its wrapper now
            // occupies — `max-h-[88dvh]` alone would still allow the sheet to
            // grow taller than the keyboard-safe area and push its own top
            // content (the gasto/ingreso toggle) back out of view.
            maxHeight: viewportInset
              ? viewportInset.height * OVERLAY_MAX_HEIGHT_FRACTION
              : undefined,
          }}
          className={cn(
            'pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-5xl border-t border-border-subtle bg-card animate-sheet-up transition-transform duration-200 ease-out',
            OVERLAY_PANEL_CLASS,
            className,
          )}
        >
          {/* Fixed chrome — a sibling of the scrolling body below, not its
              child, so dragging/scrolling the content never carries the
              handle away with it (specs.md §10.35). */}
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
          {/* `overscroll-y-contain`: a scroll-locked page (body `overflow:
              hidden`, useOverlay.ts) still lets a touch drag past this box's
              own scroll boundary chain into rubber-banding the page behind it
              on iOS Safari — containing the overscroll here keeps that bounce
              inside the sheet's own body instead of leaking to the backdrop. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5.5 pb-7">
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
