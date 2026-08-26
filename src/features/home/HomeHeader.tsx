import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { getInitials } from '@/lib/initials'
import { getGreetingKey } from '@/features/home/homeView'

export const HomeHeader = () => {
  const { t } = useTranslation('home')
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
      <button
        type="button"
        disabled
        aria-label={t('notifications')}
        className="flex min-h-11 min-w-11 items-center justify-center disabled:opacity-100"
      >
        <span className="flex size-10.5 items-center justify-center rounded-xl border border-border bg-card text-fg-secondary">
          <Bell className="size-5" aria-hidden="true" />
        </span>
      </button>
    </div>
  )
}
