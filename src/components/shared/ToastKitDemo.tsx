import { toast } from '@/lib/toastStore'

/**
 * Dev-only exercise panel for the toast surface — buttons only, no
 * `<Toaster />` of its own. `Toaster` is already mounted once, globally, by
 * `AppLock` (rendered for every route, `/kit` included), so a second
 * instance here would double-render every card. Not part of the public
 * `@/components/shared` barrel — this is Kit tooling, not a reusable
 * component. Drop it into `src/routes/Kit.tsx` inside a `<Section title="Toast">`
 * once that file is free to edit (see docs/wave-2/track-k.md).
 */
export const ToastKitDemo = () => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => toast.success('toast:demo.saved')}
        className="min-h-11 rounded-lg bg-success/15 px-3.5 text-sm font-semibold text-success"
      >
        Success
      </button>
      <button
        type="button"
        onClick={() => toast.error('toast:demo.saveFailed')}
        className="min-h-11 rounded-lg bg-danger/15 px-3.5 text-sm font-semibold text-danger"
      >
        Error
      </button>
      <button
        type="button"
        onClick={() => {
          toast.error('toast:demo.syncFailed')
          toast.error('toast:demo.syncFailed')
          toast.error('toast:demo.syncFailed')
        }}
        className="min-h-11 rounded-lg bg-muted px-3.5 text-sm font-semibold"
      >
        Duplicate collapse (×3)
      </button>
      <button
        type="button"
        onClick={() => {
          toast.success('toast:demo.one')
          toast.success('toast:demo.two')
          toast.success('toast:demo.three')
          toast.success('toast:demo.four')
        }}
        className="min-h-11 rounded-lg bg-muted px-3.5 text-sm font-semibold"
      >
        Stack cap (4th drops the oldest)
      </button>
    </div>
  )
}
