import { ChevronLeft } from 'lucide-react'

export interface ScreenHeaderProps {
  title: string
  onBack: () => void
  backLabel: string
  titleId?: string
  subtitle?: string
}

/**
 * The back-button + title row a screen with a back-bar header renders as
 * the first thing inside its shared `--screen-inset-top` container
 * (specs.md §10.34) — the row owns its own height (the button's 44px touch
 * target plus its `pb-3.5`), so "where does content start" stays one
 * number (the token) with this as an element inside it, not a second
 * hand-typed inset. `SettingsScreen.tsx` and `LockSettings.tsx` (which
 * needs the optional `subtitle` line) are its two consumers.
 */
export const ScreenHeader = ({
  title,
  onBack,
  backLabel,
  titleId,
  subtitle,
}: ScreenHeaderProps) => (
  <div className="flex items-center gap-2.5 px-5 pb-3.5">
    <button
      type="button"
      onClick={onBack}
      aria-label={backLabel}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"
    >
      <ChevronLeft className="size-4" />
    </button>
    <div className="min-w-0 flex-1">
      <h1 id={titleId} className="truncate text-xl font-extrabold tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
)
