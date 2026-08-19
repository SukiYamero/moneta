import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'

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

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
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
        className={cn(
          'absolute inset-x-6.5 top-1/2 -translate-y-1/2 rounded-3xl border border-border-subtle bg-card p-6 animate-pop-in',
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
