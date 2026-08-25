import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'

export type FullScreenPanelProps = OverlayShellProps<HTMLDivElement> & {
  /**
   * Fixed chrome above the scrollable body — a back-button/title row
   * (`LockSettings`) or a kicker/close row (`PinSetup`). A sibling of the
   * body, never its child, so scrolling long body content never carries it
   * away — the same shape `BottomSheet`'s grab handle needed (specs.md
   * §10.35.1). The top safe-area inset travels with it so it clears the
   * notch/status bar regardless of how tall the body grows; with no
   * `header`, the body keeps that inset itself.
   */
  header?: ReactNode
}

/**
 * The push-in full-screen shell behind the lock settings panel and PIN setup
 * (design export §4) — both open from inside the already-open Profile
 * `BottomSheet` (z-50), so this sits above it; both need `useOverlay`'s
 * focus-trap/Escape/scroll-lock/nesting behavior the same way every other
 * overlay in the app does. Not `src/components/shared/`: exactly two
 * consumers, both inside this feature.
 */
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
      {header !== undefined && (
        <div className="shrink-0 pt-[max(1.5rem,env(safe-area-inset-top))]">{header}</div>
      )}
      <div
        className={cn(
          // overscroll-y-contain: keep a touch drag past this box's own
          // scroll boundary from chaining into rubber-banding the (locked)
          // page behind it on iOS Safari — same reasoning as BottomSheet's
          // body (specs.md §10.35.1).
          'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          header === undefined && 'pt-[max(1.5rem,env(safe-area-inset-top))]',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
