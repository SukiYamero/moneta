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
  // Rivera" — RequireAuth guarantees `user` is set whenever this renders,
  // since authStore sets `status: 'authenticated'` and `user` together.
  const name = useAuthStore((s) => s.user?.name ?? '')
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
      <button
        type="button"
        disabled
        aria-label={t('notifications')}
        // STUB(wave3): no notification source exists yet. The design draws
        // a permanent unread dot with no binding behind it — dropped per
        // docs/ui/implementation-plan.md § Home ("no badge dot"), since a
        // static "you have something unread" claim is never true.
        className="flex size-10.5 items-center justify-center rounded-xl border border-border bg-card text-fg-secondary disabled:opacity-100"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
