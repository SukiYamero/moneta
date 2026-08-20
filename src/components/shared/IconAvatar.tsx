import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TINT_CLASSES } from '@/components/shared/tintClasses'
// Re-exported (not declared here) so schema.ts can depend on the plain
// tint-name union without depending on a component file — every existing
// `@/components/shared/IconAvatar` import of `IconAvatarTint` keeps working
// unchanged (specs.md §11, 2026-08-20).
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
export type { IconAvatarTint } from '@/lib/iconAvatarTint'

export type IconAvatarSize = 'sm' | 'md' | 'lg'

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
