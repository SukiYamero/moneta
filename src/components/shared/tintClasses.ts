import type { IconAvatarTint } from '@/lib/iconAvatarTint'

// Tailwind's static scanner only sees class names present as literal strings.
export const TINT_CLASSES: Record<
  IconAvatarTint,
  { icon: string; badge: string; pill: string; fill: string }
> = {
  emerald: {
    icon: 'text-chart-1',
    fill: 'bg-chart-1',
    badge: 'bg-chart-1/15 text-chart-1',
    pill: 'border-chart-1/40 bg-chart-1/15 text-chart-1',
  },
  blue: {
    icon: 'text-chart-2',
    fill: 'bg-chart-2',
    badge: 'bg-chart-2/15 text-chart-2',
    pill: 'border-chart-2/40 bg-chart-2/15 text-chart-2',
  },
  amber: {
    icon: 'text-chart-3',
    fill: 'bg-chart-3',
    badge: 'bg-chart-3/15 text-chart-3',
    pill: 'border-chart-3/40 bg-chart-3/15 text-chart-3',
  },
  rose: {
    icon: 'text-chart-4',
    fill: 'bg-chart-4',
    badge: 'bg-chart-4/15 text-chart-4',
    pill: 'border-chart-4/40 bg-chart-4/15 text-chart-4',
  },
  purple: {
    icon: 'text-chart-5',
    fill: 'bg-chart-5',
    badge: 'bg-chart-5/15 text-chart-5',
    pill: 'border-chart-5/40 bg-chart-5/15 text-chart-5',
  },
  success: {
    icon: 'text-success',
    fill: 'bg-success',
    badge: 'bg-success/15 text-success',
    pill: 'border-success/40 bg-success/15 text-success',
  },
  danger: {
    icon: 'text-danger',
    fill: 'bg-danger',
    badge: 'bg-danger/15 text-danger',
    pill: 'border-danger/40 bg-danger/15 text-danger',
  },
  info: {
    icon: 'text-info',
    fill: 'bg-info',
    badge: 'bg-info/15 text-info',
    pill: 'border-info/40 bg-info/15 text-info',
  },
  neutral: {
    icon: 'text-muted-foreground',
    fill: 'bg-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
    pill: 'border-border-strong bg-muted text-foreground',
  },
}

export { ICON_AVATAR_TINTS } from '@/lib/iconAvatarTint'
