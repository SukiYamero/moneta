import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useOverlay } from '@/components/shared/useOverlay'

type CenterModalLabelProps =
  | { labelledBy: string; ariaLabel?: never }
  | { ariaLabel: string; labelledBy?: never }

export type CenterModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
} & CenterModalLabelProps

/** The centered popup shell (Delete confirm, Info tooltip, Custom tag modal, Group editor…). */
export function CenterModal({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  className,
}: CenterModalProps) {
  const panelRef = useOverlay<HTMLDivElement>({ open, onClose })

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
          'absolute inset-x-[26px] top-1/2 -translate-y-1/2 rounded-3xl border border-border-subtle bg-card p-6 animate-pop-in',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
