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
        onClick={() => toast.success('Movimiento guardado')}
        className="min-h-11 rounded-lg bg-success/15 px-3.5 text-sm font-semibold text-success"
      >
        Success
      </button>
      <button
        type="button"
        onClick={() => toast.error('No se pudo guardar el movimiento')}
        className="min-h-11 rounded-lg bg-danger/15 px-3.5 text-sm font-semibold text-danger"
      >
        Error
      </button>
      <button
        type="button"
        onClick={() => {
          toast.error('Falló la sincronización')
          toast.error('Falló la sincronización')
          toast.error('Falló la sincronización')
        }}
        className="min-h-11 rounded-lg bg-muted px-3.5 text-sm font-semibold"
      >
        Duplicate collapse (×3)
      </button>
      <button
        type="button"
        onClick={() => {
          toast.success('Uno')
          toast.success('Dos')
          toast.success('Tres')
          toast.success('Cuatro')
        }}
        className="min-h-11 rounded-lg bg-muted px-3.5 text-sm font-semibold"
      >
        Stack cap (4th drops the oldest)
      </button>
    </div>
  )
}
