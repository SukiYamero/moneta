import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { listProfiles, type ProfileRecord } from '@/lib/profiles'
import { getInitials } from '@/lib/initials'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { loginErrorCopy } from '@/features/auth/errorCopy'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { GuestSignInButton } from '@/features/auth/GuestSignInButton'

const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? ''

const mostRecentGoogleProfile = (profiles: ProfileRecord[]): ProfileRecord | null =>
  profiles
    .filter((p) => p.kind === 'google')
    .reduce<ProfileRecord | null>(
      (latest, candidate) =>
        !latest || candidate.lastUsedAt > latest.lastUsedAt ? candidate : latest,
      null,
    )

export const ReturningUserScreen = () => {
  const { t } = useTranslation('auth')
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)
  const busy = status === 'authenticating'
  const [guestConfirmOpen, setGuestConfirmOpen] = useState(false)

  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  useEffect(() => {
    void listProfiles().then((profiles) => setProfile(mostRecentGoogleProfile(profiles)))
  }, [])

  const name = profile?.label ?? ''
  const firstName = name ? firstNameOf(name) : ''
  const email = profile?.accountKey?.includes('@') ? profile.accountKey : null

  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="absolute -top-20 left-1/2 h-[21rem] w-[21rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_color-mix(in_oklch,var(--primary)_28%,transparent),_transparent_68%)]"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-7 text-center">
        <div className="flex size-13.5 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] shadow-[0_16px_40px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)]">
          <Coins className="size-7 text-primary-foreground" strokeWidth={2.25} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            {firstName
              ? t('return.greetingNamed', { name: firstName })
              : t('return.greetingGeneric')}
          </h1>
          <p className="text-md leading-relaxed font-medium text-muted-foreground">
            {t('return.subtitle')}
            <br />
            {t('return.reassurance')}
          </p>
        </div>

        <div className="flex w-full max-w-xs items-center gap-3 rounded-3xl border border-border-subtle bg-card p-3.5 text-left">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-sm font-extrabold text-primary-foreground"
          >
            {getInitials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{name || t('return.greetingGeneric')}</p>
            {email ? (
              <p className="truncate text-sm font-medium text-fg-tertiary">{email}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-2xs font-bold text-warning">
            {t('return.expiredChip')}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-2.5 px-7 pb-11">
        {status === 'error' && error ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {t(loginErrorCopy(error))}
          </p>
        ) : null}
        <GoogleSignInButton onClick={() => void login()} busy={busy}>
          {firstName
            ? t('return.continueCtaNamed', { name: firstName })
            : t('return.continueCtaGeneric')}
        </GoogleSignInButton>
        <GuestSignInButton onClick={() => setGuestConfirmOpen(true)} disabled={busy}>
          {t('return.guestCta')}
        </GuestSignInButton>
      </div>
      <ConfirmDialog
        open={guestConfirmOpen}
        onClose={() => setGuestConfirmOpen(false)}
        onConfirm={() => {
          setGuestConfirmOpen(false)
          continueAsGuest()
        }}
        title={t('return.guestConfirm.title')}
        description={t('return.guestConfirm.description')}
        confirmLabel={t('return.guestConfirm.confirmCta')}
        cancelLabel={t('return.guestConfirm.cancelCta')}
        destructive={false}
      />
    </main>
  )
}
