export const ICON_AVATAR_TINTS = [
  'emerald',
  'blue',
  'purple',
  'rose',
  'amber',
  'success',
  'danger',
  'info',
  'neutral',
] as const

export type IconAvatarTint = (typeof ICON_AVATAR_TINTS)[number]
