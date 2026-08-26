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
  destructive: boolean
  ref?: Ref<HTMLDivElement>
}

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
