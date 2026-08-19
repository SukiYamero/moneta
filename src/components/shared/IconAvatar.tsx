import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TINT_CLASSES } from '@/components/shared/tintClasses'

export type IconAvatarSize = 'sm' | 'md' | 'lg'

/**
 * Tint families map onto the existing chart-* and status tokens
 * (see src/styles/index.css) instead of introducing new hex values —
 * category color is presentation, not a new brand color.
 */
export type IconAvatarTint =
  | 'emerald'
  | 'blue'
  | 'purple'
  | 'rose'
  | 'amber'
  | 'success'
  | 'danger'
  | 'info'
  | 'neutral'

const SIZE_CLASSES: Record<IconAvatarSize, string> = {
  sm: 'size-8 rounded-sm [&_svg]:size-4',
  md: 'size-11 rounded-lg [&_svg]:size-5',
  lg: 'size-13 rounded-xl [&_svg]:size-6',
}

export interface IconAvatarProps {
  icon: LucideIcon
  size?: IconAvatarSize
  tint: IconAvatarTint
  className?: string
}

export const IconAvatar = ({ icon: Icon, size = 'md', tint, className }: IconAvatarProps) => {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        SIZE_CLASSES[size],
        TINT_CLASSES[tint].badge,
        className,
      )}
      aria-hidden="true"
    >
      <Icon />
    </div>
  )
}
