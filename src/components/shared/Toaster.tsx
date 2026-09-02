import { createPortal } from 'react-dom'
import { Toast } from '@/components/shared/Toast'
import { dismissToast, removeToast, useToastStore } from '@/lib/toastStore'

export const Toaster = () => {
  const items = useToastStore((state) => state.items)

  if (items.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col-reverse items-center gap-2 px-4 pb-(--bottom-nav-clearance)">
      {items.map((item) => (
        <Toast
          key={item.id}
          item={item}
          onDismiss={() => dismissToast(item.id)}
          onExited={() => removeToast(item.id)}
        />
      ))}
    </div>,
    document.body,
  )
}
