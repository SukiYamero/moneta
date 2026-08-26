import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'

export type FullScreenPanelProps = OverlayShellProps<HTMLDivElement> & {
  header?: ReactNode
}

export const FullScreenPanel = ({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
  initialFocus,
  header,
  ref,
}: FullScreenPanelProps) => {
  const panelRef = useOverlay<HTMLDivElement>({ open, onClose, initialFocus, ref })

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-[55] flex min-h-dvh flex-col animate-push-in bg-background',
        OVERLAY_PANEL_CLASS,
        className,
      )}
    >
      {header !== undefined && <div className="shrink-0 pt-(--overlay-inset-top)">{header}</div>}
      <div
        className={cn(
          // overscroll-y-contain stops a touch drag past this box's scroll boundary from
          // rubber-band-chaining into the locked page behind it on iOS Safari.
          'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-(--overlay-inset-bottom)',
          header === undefined && 'pt-(--overlay-inset-top)',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
