import { ChevronLeft } from 'lucide-react'

export interface ScreenHeaderProps {
  title: string
  onBack: () => void
  backLabel: string
  titleId?: string
}

/**
 * The back-button + title row a screen with a back-bar header renders as
 * the first thing inside its shared `--screen-inset-top` container
 * (specs.md §10.34) — the row owns its own height (the button's 44px touch
 * target plus its `pb-3.5`), so "where does content start" stays one
 * number (the token) with this as an element inside it, not a second
 * hand-typed inset. `SettingsScreen.tsx` is the first consumer;
 * `src/features/lock/LockSettings.tsx` renders the byte-identical row
 * independently (not migrated here — outside this track's file ownership,
 * flagged for the operator).
 */
export const ScreenHeader = ({ title, onBack, backLabel, titleId }: ScreenHeaderProps) => (
  <div className="flex items-center gap-2.5 px-5 pb-3.5">
    <button
      type="button"
      onClick={onBack}
      aria-label={backLabel}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"
    >
      <ChevronLeft className="size-4" />
    </button>
    <h1 id={titleId} className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">
      {title}
    </h1>
  </div>
)
