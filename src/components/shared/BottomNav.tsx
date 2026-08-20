import { History, House, Plus, Search, User, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const ACTIVE_STROKE = 2.5
const INACTIVE_STROKE = 2

// Lucide has no filled variant (design uses ph vs ph-fill for active/inactive,
// docs/ui/design-tokens.md) — active state is expressed with the primary
// token color plus a heavier strokeWidth instead.
const NavTab = ({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) => {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.75"
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('size-6.5', isActive ? 'text-primary' : 'text-fg-disabled')}
            strokeWidth={isActive ? ACTIVE_STROKE : INACTIVE_STROKE}
            aria-hidden="true"
          />
          <span
            className={cn('text-2xs font-semibold', isActive ? 'text-primary' : 'text-fg-disabled')}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export interface BottomNavProps {
  /** Whether the profile sheet the Profile slot opens is currently open — drives its active-tab styling. */
  profileOpen: boolean
  onOpenProfile: () => void
}

/**
 * Persistent tab bar for '/', '/search' and '/history' (mounted once by
 * AppShell, never remounted on tab change — see docs/wave-2/track-l.md for
 * why that persistence matters for the push/fade transitions to read as
 * native). Five design slots: Home/History/Search are real NavLinks
 * (`aria-current="page"` comes from NavLink itself); the Profile slot opens
 * the profile/account sheet (specs.md §10.18) via `onOpenProfile` — the
 * sheet itself (and its `open` state) lives in `AppShell.tsx`, not here:
 * `src/components/shared/**` is feature-agnostic building blocks that
 * features/routes compose, and `ProfileSheet` is a `src/features/profile`
 * concern, so this file takes the callback rather than importing the
 * feature and inverting that dependency direction. The centre Add button
 * still has no destination this wave and stays a disabled stub
 * (`docs/ui/implementation-plan.md`).
 */
export const BottomNav = ({ profileOpen, onOpenProfile }: BottomNavProps) => {
  const { t } = useTranslation('nav')

  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-50 flex h-(--bottom-nav-clearance) items-center justify-between bg-[linear-gradient(to_top,var(--color-canvas)_60%,color-mix(in_oklch,var(--color-canvas)_92%,transparent)_88%,transparent)] px-6 pb-[calc(env(safe-area-inset-bottom)+1.375rem)]"
    >
      <NavTab to="/" icon={House} label={t('home')} />
      <NavTab to="/history" icon={History} label={t('history')} />
      <button
        type="button"
        disabled
        aria-label={t('add')}
        // STUB(trackF): opens the Add-movimiento sheet — Wave 3.
        className="flex size-14.5 shrink-0 -translate-y-4.5 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-primary-foreground shadow-[0_8px_22px_color-mix(in_oklch,var(--primary)_35%,transparent)]"
      >
        <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <NavTab to="/search" icon={Search} label={t('search')} />
      <button
        type="button"
        aria-label={t('profile')}
        aria-haspopup="dialog"
        aria-expanded={profileOpen}
        onClick={onOpenProfile}
        className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.75"
      >
        <User
          className={cn('size-6.5', profileOpen ? 'text-primary' : 'text-fg-disabled')}
          strokeWidth={profileOpen ? ACTIVE_STROKE : INACTIVE_STROKE}
          aria-hidden="true"
        />
        <span
          className={cn(
            'text-2xs font-semibold',
            profileOpen ? 'text-primary' : 'text-fg-disabled',
          )}
        >
          {t('profile')}
        </span>
      </button>
    </nav>
  )
}
