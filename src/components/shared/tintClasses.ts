import type { IconAvatarTint } from '@/lib/iconAvatarTint'

/**
 * Single source of truth for which chart/status token each tint name
 * resolves to, in every shape a consumer needs. Tailwind's static scanner
 * needs each class name to appear as a literal string, so the three shapes
 * can't be built by concatenating a shorter per-tint fragment at runtime —
 * but they can still live in one exhaustive table instead of one per
 * consumer, which is what let `TagChip`'s own copy silently carry its own
 * "amber = chart-3" pairing instead of `IconAvatar`'s.
 * `icon`: text-only, for an always-colored icon on a neutral surface.
 * `badge`: translucent bg + text, `IconAvatar`'s filled square.
 * `pill`: `badge` plus a border, `TagChip`'s selected treatment.
 * `fill`: opaque, for a solid bar — the badge/pill shapes are translucent
 * (`/15`) for an icon on a surface, which reads washed out as a progress
 * bar. Added so `BreakdownCard` stops carrying a fourth private copy of
 * this mapping (`specs.md` §12, closed 2026-08-20).
 */
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

/** Every `IconAvatarTint`, in a stable order — derived from `TINT_CLASSES` so a consumer that needs "all nine tints" (a color grid, the least-used-tint rule) never keeps its own second copy of the enum. */
// Re-exported from its canonical home so the many existing
// `@/components/shared/tintClasses` importers keep working; the list itself
// lives in `src/lib/` because the sync layer validates against it and must
// not import the UI (specs.md §11, 2026-08-20).
export { ICON_AVATAR_TINTS } from '@/lib/iconAvatarTint'
