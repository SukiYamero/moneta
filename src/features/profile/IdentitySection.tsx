import { LogIn, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { getInitials } from '@/features/home/homeView'
import { loginErrorCopy } from '@/features/auth/errorCopy'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'
import { useSignOutConfirm } from '@/features/profile/useSignOutConfirm'

/**
 * The door §10.18 exists for: a signed-in Google account with a real
 * sign-out, or an honest "Invitado" state with the sign-in row that is
 * guest mode's only exit (specs.md §10.10). Both the CTA and its error
 * copy are read from the `auth` namespace, not duplicated into `profile`
 * — it's the exact same `login()` action `WelcomeScreen` already exposes,
 * just reachable from a second place.
 *
 * Sign-out itself goes through `useSignOutConfirm` (specs.md §10.20): with
 * Drive connected, or with nothing unsynced, it signs out directly — the
 * confirm dialog only interrupts when local data would otherwise be left
 * feeling stranded.
 */
export const IdentitySection = () => {
  const { t } = useTranslation('profile')
  const { t: tAuth } = useTranslation('auth')
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const authError = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const { confirmOpen, pendingCount, checking, requestSignOut, confirmSignOut, cancelSignOut } =
    useSignOutConfirm()

  const isAuthenticated = status === 'authenticated'
  const busy = status === 'authenticating'

  return (
    <section>
      <ProfileSectionHeading>{t('identity.heading')}</ProfileSectionHeading>
      {isAuthenticated ? (
        <div className="flex items-center gap-3.25 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-sm font-extrabold text-primary-foreground"
          >
            {getInitials(user?.name ?? '')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {user?.name ?? t('identity.loadingAccount')}
            </p>
            {user?.email ? (
              <p className="truncate text-ms font-medium text-fg-tertiary">{user.email}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={checking}
            onClick={() => void requestSignOut()}
          >
            <LogOut aria-hidden="true" />
            {t('identity.signOutCta')}
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onClose={cancelSignOut}
            onConfirm={confirmSignOut}
            title={t('identity.signOutConfirm.title')}
            description={t('identity.signOutConfirm.description', { count: pendingCount })}
            confirmLabel={t('identity.signOutCta')}
            cancelLabel={t('identity.signOutConfirm.cancelCta')}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
          <div>
            <p className="text-sm font-bold">{t('identity.guestLabel')}</p>
            <p className="mt-0.5 text-ms font-medium text-fg-tertiary">
              {t('identity.guestDescription')}
            </p>
          </div>
          <Button
            type="button"
            size="touch"
            disabled={busy}
            onClick={() => void login()}
            className="justify-center gap-2"
          >
            <LogIn aria-hidden="true" />
            {busy ? tAuth('welcome.connecting') : tAuth('welcome.googleCta')}
          </Button>
          {status === 'error' && authError ? (
            <p role="alert" className="text-sm text-destructive">
              {tAuth(loginErrorCopy(authError))}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
