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

export type CenterModalProps = OverlayShellProps<HTMLDivElement>

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
  const { backdropRef, onClick: handleBackdropClick } = useBackdropDismiss<HTMLDivElement>(
    open,
    onClose,
  )
  if (!open) return null

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
        className={cn('fixed z-50 animate-fade-in bg-black/70', OVERLAY_FIXED_LAYER_OPACITY_CLASS)}
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
          className={cn(
            'pointer-events-auto absolute inset-x-6.5 top-1/2 max-h-[88dvh] -translate-y-1/2 overflow-y-auto overscroll-y-contain rounded-3xl border border-border-subtle bg-card p-6 animate-pop-in',
            OVERLAY_PANEL_CLASS,
            OVERLAY_FIXED_LAYER_OPACITY_CLASS,
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
