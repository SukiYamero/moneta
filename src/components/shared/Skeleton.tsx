import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SkeletonProps = ComponentPropsWithRef<'div'>

export const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-2xl bg-card', className)}
    {...props}
  />
)

export interface SkeletonGroupProps {
  label: string
  className?: string
  children: ReactNode
}

export const SkeletonGroup = ({ label, className, children }: SkeletonGroupProps) => (
  <div aria-busy="true" className={className}>
    <span className="sr-only" role="status">
      {label}
    </span>
    {children}
  </div>
)
