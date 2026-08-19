import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SkeletonProps = ComponentPropsWithRef<'div'>

/**
 * A single decorative placeholder block, shaped by the caller's own
 * `className` (height/radius) to match the loaded layout it stands in for.
 * `animate-pulse` already respects `prefers-reduced-motion` via the global
 * override in `index.css` — never bypass that with an inline animation.
 */
export const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-2xl bg-card', className)}
    {...props}
  />
)

export interface SkeletonGroupProps {
  /** Announced once to screen readers — never per-block (docs/error-handling.md §7, `role="status"` is polite). */
  label: string
  className?: string
  children: ReactNode
}

/**
 * Wraps a set of `Skeleton` blocks with the accessible shape every loading
 * tier shares: `aria-busy` on the container, one `sr-only role="status"`
 * announcement, decoration blocks left `aria-hidden` inside `Skeleton`
 * itself — not fifty individually-announced boxes.
 */
export const SkeletonGroup = ({ label, className, children }: SkeletonGroupProps) => (
  <div aria-busy="true" className={className}>
    <span className="sr-only" role="status">
      {label}
    </span>
    {children}
  </div>
)
