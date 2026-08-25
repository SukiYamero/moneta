import type { ReactNode } from 'react'

interface GuestSignInButtonProps {
  onClick: () => void
  disabled: boolean
  children: ReactNode
}

/**
 * Shared "Continue as guest" secondary CTA — byte-identical between
 * `WelcomeScreen` and `ReturningUserScreen` before this extraction
 * (`specs.md` §10.40), same precedent as `GoogleSignInButton` for the
 * primary CTA. The two screens differ in what a click does (enter guest
 * mode directly vs. open a confirm dialog first) and in their label copy,
 * both of which stay the caller's job.
 */
export const GuestSignInButton = ({ onClick, disabled, children }: GuestSignInButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-14 items-center justify-center rounded-2xl border border-border-subtle bg-transparent text-base font-bold text-foreground transition-opacity disabled:opacity-60"
  >
    {children}
  </button>
)
