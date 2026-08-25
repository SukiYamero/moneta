import { useId, type Ref } from 'react'
import { Button } from '@/components/ui/button'
import { CenterModal } from '@/components/shared/CenterModal'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  /**
   * Whether confirming is an irreversible, data-losing action. Required,
   * not defaulted: a silent default in either direction is unsafe — always
   * `true` paints a harmless action (sign out, switch to guest) as a delete,
   * always `false` lets a future real delete ship looking safe the moment a
   * caller forgets to override it. Making the caller state it every time is
   * the only shape where both mistakes are compile errors instead of a
   * choice one direction quietly favors (`specs.md` §10.40).
   */
  destructive: boolean
  ref?: Ref<HTMLDivElement>
}

/**
 * Generic confirm/cancel dialog built on `CenterModal` — inherits its
 * Escape/focus-trap/scroll-lock/nesting behavior from `useOverlay` rather
 * than reimplementing any of it. Copy comes in as props: this component
 * adds no locale keys of its own (`specs.md` §10.14, `docs/wave-3-plan.md`
 * §1.7). `destructive` picks the confirm button's paint — see that prop's
 * own doc comment for why it has no default.
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  ref,
}: ConfirmDialogProps) => {
  const titleId = useId()

  return (
    <CenterModal open={open} onClose={onClose} labelledBy={titleId} ref={ref}>
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 id={titleId} className="text-base font-extrabold">
          {title}
        </h2>
        {description !== undefined && <p className="text-sm text-fg-secondary">{description}</p>}
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="flex-1"
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            size="touch"
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </CenterModal>
  )
}
