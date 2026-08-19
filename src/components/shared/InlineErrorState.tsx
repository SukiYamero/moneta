export interface InlineErrorStateProps {
  message: string
  retryLabel: string
  onRetry: () => void
}

/**
 * The minimal inline error treatment Search and History share for a
 * mid-screen load failure — previously two byte-identical, independently
 * maintained copies. Deliberately lighter-weight than `HomeErrorState`'s
 * card+icon treatment; whether the two should also look the same is a
 * design call left open, not decided here.
 */
export const InlineErrorState = ({ message, retryLabel, onRetry }: InlineErrorStateProps) => (
  <div className="flex flex-col items-center gap-3 pt-16 text-center">
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="min-h-11 rounded-lg border border-border-subtle px-4 text-sm font-bold text-fg-secondary"
    >
      {retryLabel}
    </button>
  </div>
)
