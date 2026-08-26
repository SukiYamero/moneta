import { Coins } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { APP_NAME } from '@/lib/branding'
import { loginErrorCopy } from '@/features/auth/errorCopy'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { GuestSignInButton } from '@/features/auth/GuestSignInButton'

export const WelcomeScreen = () => {
  const { t } = useTranslation('auth')
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)
  const busy = status === 'authenticating'

  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="absolute -top-20 left-1/2 h-[21rem] w-[21rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_color-mix(in_oklch,var(--primary)_28%,transparent),_transparent_68%)]"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-9 text-center">
        <div className="flex size-[5.25rem] items-center justify-center rounded-4xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] shadow-[0_16px_40px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)]">
          <Coins className="size-10 text-primary-foreground" strokeWidth={2.25} />
        </div>
        <div className="space-y-2.5">
          <h1 className="text-[2.125rem] font-extrabold tracking-tight text-balance">{APP_NAME}</h1>
          <p className="text-md leading-relaxed font-medium text-muted-foreground">
            {t('welcome.subtitleLine1')}
            <br />
            {t('welcome.subtitleLine2')}
          </p>
        </div>
      </div>
      <div className="relative z-10 flex flex-col gap-4 px-7 pb-8">
        <GoogleSignInButton onClick={() => void login()} busy={busy}>
          {t('welcome.googleCta')}
        </GoogleSignInButton>
        <div className="my-3 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border-subtle" />
          <span className="text-xs font-semibold tracking-wide text-fg-disabled uppercase">
            {t('welcome.orDivider')}
          </span>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>
        <div className="flex flex-col gap-2.5">
          <GuestSignInButton onClick={() => continueAsGuest()} disabled={busy}>
            {t('welcome.guestCta')}
          </GuestSignInButton>
          <p className="text-center text-xs leading-relaxed font-medium text-fg-disabled">
            {t('welcome.guestReassurance')}
          </p>
        </div>
        <p className="mt-2 text-center text-xs leading-relaxed font-medium text-fg-disabled">
          <Trans
            t={t}
            i18nKey="welcome.legal"
            components={{
              terms: <span className="text-muted-foreground" />,
              privacy: <span className="text-muted-foreground" />,
            }}
          />
        </p>
        {status === 'error' && error ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {t(loginErrorCopy(error))}
          </p>
        ) : null}
      </div>
    </main>
  )
}
