import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { getGreetingKey, getInitials } from '@/features/home/homeView'

// The greeting is the screen's <h1> — it's what the design actually
// presents as Home's subject, not the app name (which appears nowhere on
// this screen). Two visually-stacked lines, one accessible heading: a
// screen-reader user hears "Buenos días Alex Rivera", not the app's own
// name repeated on the one route where it's least informative.
export const HomeHeader = () => {
  const { t } = useTranslation('home')
  // Real Google profile data (authStore.user), not the design's mock "Alex
  // Rivera" — but RequireAuth also lets a guest (specs.md §10.10) straight
  // through with `user` still null, so this can't assume a profile exists.
  const isGuest = useAuthStore((s) => s.status === 'guest')
  const userName = useAuthStore((s) => s.user?.name)
  const name = isGuest ? t('guestName') : (userName ?? '')
  const greetingKey = getGreetingKey(new Date())

  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-10.5 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-sm font-extrabold text-primary-foreground"
        >
          {getInitials(name)}
        </div>
        <h1 className="leading-snug">
          <span className="block text-ms font-medium text-fg-tertiary">
            {t(`greeting.${greetingKey}`)}
          </span>
          <span className="mt-0.25 block text-xl font-bold">{name}</span>
        </h1>
      </div>
      {/* Hit area (min-h/w-11, AGENTS.md's 44px floor) and visible pill are
          split: the design's pill is 42px, growing it to 44px would resize
          the badge itself, not just its tap target (same pattern as the
          month-nav buttons in DateChipPicker.tsx). */}
      <button
        type="button"
        disabled
        aria-label={t('notifications')}
        // STUB(wave3): no notification source exists yet. The design draws
        // a permanent unread dot with no binding behind it — dropped per
        // docs/ui/implementation-plan.md § Home ("no badge dot"), since a
        // static "you have something unread" claim is never true.
        className="flex min-h-11 min-w-11 items-center justify-center disabled:opacity-100"
      >
        <span className="flex size-10.5 items-center justify-center rounded-xl border border-border bg-card text-fg-secondary">
          <Bell className="size-5" aria-hidden="true" />
        </span>
      </button>
    </div>
  )
}
