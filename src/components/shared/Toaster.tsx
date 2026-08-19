import { createPortal } from 'react-dom'
import { Toast } from '@/components/shared/Toast'
import { dismissToast, useToastStore } from '@/lib/toastStore'

/**
 * App-wide notification surface. Mounted once, inside `AppLock`, only while
 * `phase !== 'locked'` — see `AppLock.tsx`. Portals to `document.body` so it
 * sits in its own stacking context above every `BottomSheet`/`CenterModal`
 * (both `z-50`) regardless of where in the tree it renders, and survives
 * the unmount of whatever raised the toast (specs.md §10.6).
 *
 * Oldest toast renders nearest the anchored bottom edge; `flex-col-reverse`
 * over an array kept oldest-first means a newer arrival stacks above the
 * existing ones without repositioning them, and a toast leaving the middle
 * of the stack just reflows normally — no computed pixel offsets to jump.
 */
export const Toaster = () => {
  const items = useToastStore((state) => state.items)

  if (items.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col-reverse items-center gap-2 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {items.map((item) => (
        <Toast key={item.id} item={item} onDismiss={() => dismissToast(item.id)} />
      ))}
    </div>,
    document.body,
  )
}
