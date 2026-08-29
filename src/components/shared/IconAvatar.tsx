import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TINT_CLASSES } from '@/components/shared/tintClasses'
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
export type { IconAvatarTint } from '@/lib/iconAvatarTint'

export type IconAvatarSize = 'sm' | 'md' | 'lg' | 'compact' | 'tile'

const SIZE_CLASSES: Record<IconAvatarSize, string> = {
  sm: 'size-8 rounded-sm [&_svg]:size-4',
  md: 'size-11 rounded-lg [&_svg]:size-5',
  lg: 'size-13 rounded-xl [&_svg]:size-6',
  compact: 'size-8.5 rounded-sm [&_svg]:size-4',
  tile: 'size-10.5 rounded-md [&_svg]:size-5.5',
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
