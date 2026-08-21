import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  OVERLAY_PANEL_CLASS,
  useOverlay,
  type OverlayShellProps,
} from '@/components/shared/useOverlay'

export type FullScreenPanelProps = OverlayShellProps<HTMLDivElement>

/**
 * The push-in full-screen shell behind the lock settings panel and PIN setup
 * (design export §4) — both open from inside the already-open Profile
 * `BottomSheet` (z-50), so this sits above it; both need `useOverlay`'s
 * focus-trap/Escape/scroll-lock/nesting behavior the same way every other
 * overlay in the app does. Not `src/components/shared/`: exactly two
 * consumers, both inside this feature (AGENTS.md's shared-tree ownership).
 */
export const FullScreenPanel = ({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
  initialFocus,
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
        'fixed inset-0 z-[55] flex min-h-dvh animate-push-in flex-col overflow-y-auto bg-background pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        OVERLAY_PANEL_CLASS,
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
