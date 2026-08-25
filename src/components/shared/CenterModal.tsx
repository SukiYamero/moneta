import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'
import { useVisualViewportInset } from '@/components/shared/useVisualViewportInset'

export type CenterModalProps = OverlayShellProps<HTMLDivElement>

/** Matches `BottomSheet`'s own fraction — a centered popup gets the same share of the visible space. */
const OVERLAY_MAX_HEIGHT_FRACTION = 0.88

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
    // Same wrapper correction as `BottomSheet` — see its own comment. Also
    // what re-centers this modal within the keyboard-safe area: `top-1/2`
    // below resolves against this wrapper, so once its height matches the
    // real visible height, centering follows for free.
    <div
      className="fixed inset-0 z-50"
      style={viewportInset ? { top: viewportInset.top, height: viewportInset.height } : undefined}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/70"
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
          // Previously unbounded and unscrollable at any height — content
          // taller than the (keyboard-shrunk or not) visible area had no
          // way to reveal what overflowed top or bottom (specs.md §10.49).
          maxHeight: viewportInset ? viewportInset.height * OVERLAY_MAX_HEIGHT_FRACTION : undefined,
        }}
        className={cn(
          'absolute inset-x-6.5 top-1/2 max-h-[88dvh] -translate-y-1/2 overflow-y-auto overscroll-y-contain rounded-3xl border border-border-subtle bg-card p-6 animate-pop-in',
          OVERLAY_PANEL_CLASS,
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
