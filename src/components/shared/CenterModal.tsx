import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'
import {
  OVERLAY_BACKDROP_OVERSCAN_BLOCK,
  OVERLAY_BACKDROP_OVERSCAN_INLINE,
  OVERLAY_MAX_HEIGHT_FRACTION,
  useVisualViewportInset,
} from '@/components/shared/useVisualViewportInset'

export type CenterModalProps = OverlayShellProps<HTMLDivElement>

/** The centered popup shell (Delete confirm, Info tooltip, Custom tag modal, Group editor…). */
export const CenterModal = ({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
  initialFocus,
  ref,
}: CenterModalProps) => {
  const panelRef = useOverlay<HTMLDivElement>({ open, onClose, initialFocus, ref })
  const viewportInset = useVisualViewportInset(open)

  if (!open) return null

  return createPortal(
    <>
      {/* Always the full layout viewport, never clamped by `viewportInset`
          below — see `BottomSheet`'s own comment (same shared bug: a real
          iPhone showed `BottomNav` through the strip a keyboard-shrunk
          visual viewport leaves outside the corrected wrapper, because this
          backdrop used to shrink along with it, specs.md §10.49, cross-track
          review). Also overscans past `inset-0` on every edge — same
          reasoning as `BottomSheet`'s own comment (specs.md §10.53). */}
      <div
        onClick={onClose}
        style={{
          top: OVERLAY_BACKDROP_OVERSCAN_BLOCK,
          bottom: OVERLAY_BACKDROP_OVERSCAN_BLOCK,
          left: OVERLAY_BACKDROP_OVERSCAN_INLINE,
          right: OVERLAY_BACKDROP_OVERSCAN_INLINE,
        }}
        className="fixed z-50 animate-fade-in bg-black/70"
        aria-hidden="true"
      />
      {/* Same wrapper correction as `BottomSheet` — see its own comment. Also
          what re-centers this modal within the keyboard-safe area: `top-1/2`
          below resolves against this wrapper, so once its height matches the
          real visible height, centering follows for free.
          `pointer-events-none` (with `auto` restored on the panel) lets a
          tap inside this box but outside the panel fall through to the
          backdrop above instead of being swallowed by an invisible div. */}
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
            // Previously unbounded and unscrollable at any height — content
            // taller than the (keyboard-shrunk or not) visible area had no
            // way to reveal what overflowed top or bottom (specs.md §10.49).
            maxHeight: viewportInset
              ? viewportInset.height * OVERLAY_MAX_HEIGHT_FRACTION
              : undefined,
          }}
          className={cn(
            'pointer-events-auto absolute inset-x-6.5 top-1/2 max-h-[88dvh] -translate-y-1/2 overflow-y-auto overscroll-y-contain rounded-3xl border border-border-subtle bg-card p-6 animate-pop-in',
            OVERLAY_PANEL_CLASS,
            className,
          )}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
