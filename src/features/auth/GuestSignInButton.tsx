import type { ReactNode } from 'react'

interface GuestSignInButtonProps {
  onClick: () => void
  disabled: boolean
  children: ReactNode
}

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
