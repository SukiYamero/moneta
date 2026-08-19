import { Coins } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { APP_NAME } from '@/lib/branding'
import { loginErrorCopy } from '@/features/auth/errorCopy'

// Official "Sign in with Google" button surface: fixed white/near-black per
// Google's own brand guidelines, not our app palette — same deliberate
// exception as the G-logo colors below it (docs/ui/design-tokens.md).
const GoogleGlyph = () => {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export const WelcomeScreen = () => {
  const { t } = useTranslation('auth')
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)
  const busy = status === 'authenticating'

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="absolute -top-20 left-1/2 h-[21rem] w-[21rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_color-mix(in_oklch,var(--primary)_28%,transparent),_transparent_68%)]"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-9 text-center">
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
      <div className="relative z-10 flex flex-col gap-4 px-7 pb-11">
        <button
          type="button"
          onClick={() => void login()}
          disabled={busy}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-white text-base font-bold text-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,.3)] transition-opacity disabled:opacity-60"
        >
          {busy ? (
            t('welcome.connecting')
          ) : (
            <>
              <GoogleGlyph />
              {t('welcome.googleCta')}
            </>
          )}
        </button>
        <p className="text-center text-xs leading-relaxed font-medium text-fg-disabled">
          <Trans
            t={t}
            i18nKey="welcome.legal"
            components={{
              terms: <span className="text-muted-foreground" />,
              privacy: <span className="text-muted-foreground" />,
            }}
          />
        </p>
        {/* Generous separation (specs.md §10.10): the divider's own my-6
            margin stacks on top of the container's gap-4, so the guest
            choice reads as a second, distinct zone rather than one more
            item in the button stack above it. */}
        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border-subtle" />
          <span className="text-xs font-semibold tracking-wide text-fg-disabled uppercase">
            {t('welcome.orDivider')}
          </span>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => continueAsGuest()}
            disabled={busy}
            className="flex h-14 items-center justify-center rounded-2xl border border-border-subtle bg-transparent text-base font-bold text-foreground transition-opacity disabled:opacity-60"
          >
            {t('welcome.guestCta')}
          </button>
          <p className="text-center text-xs leading-relaxed font-medium text-fg-disabled">
            {t('welcome.guestReassurance')}
          </p>
        </div>
        {status === 'error' && error ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {t(loginErrorCopy(error))}
          </p>
        ) : null}
      </div>
    </main>
  )
}
