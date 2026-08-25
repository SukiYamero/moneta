import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { listProfiles, type ProfileRecord } from '@/lib/profiles'
import { getInitials } from '@/lib/initials'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { loginErrorCopy } from '@/features/auth/errorCopy'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'

const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? ''

// Only a `'google'` profile can have a lapsed session to resume — a guest
// reopening the app never sets the login marker that gates this screen in
// the first place (specs.md §10.10), but a device that signed into Google
// and *later* also used guest mode would otherwise resolve to the more
// recently touched local profile via plain recency (`getActiveProfile()`),
// misnaming the account on screen. Most-recently-used among `'google'`
// profiles only.
const mostRecentGoogleProfile = (profiles: ProfileRecord[]): ProfileRecord | null =>
  profiles
    .filter((p) => p.kind === 'google')
    .reduce<ProfileRecord | null>(
      (latest, candidate) =>
        !latest || candidate.lastUsedAt > latest.lastUsedAt ? candidate : latest,
      null,
    )

/**
 * specs.md §10.21: a returning user whose silent re-auth failed sees their
 * own name and a primary "continue with Google" action, never the first-run
 * pitch. Rendered by `RequireAuth` once the boot-time restore has settled
 * without reaching `'authenticated'`, for a device the login marker already
 * proves has signed in before.
 *
 * specs.md §10.37: a second action, "continue as guest," was added back
 * after §10.36 removed the redundant "use another account" — gated behind
 * a confirm dialog rather than a bare button, since tapping it rebinds the
 * app to a different, empty local profile (specs.md §10.15) while this
 * profile's real data stays untouched one profile over. The dialog is the
 * one place that says so; it does not repeat §10.21's forbidden first-run
 * pitch or legal copy.
 */
export const ReturningUserScreen = () => {
  const { t } = useTranslation('auth')
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)
  const busy = status === 'authenticating'
  const [guestConfirmOpen, setGuestConfirmOpen] = useState(false)

  // Device-local only (specs.md §11, 2026-08-19: `authStore.user` is empty
  // here — there is no live session to have populated it from). Degrades to
  // the generic copy while resolving or if the registry has nothing,
  // instead of a blank name (§10.21's own edge case) — cosmetic-only, so
  // showing the generic variant first and upgrading in place once resolved
  // is not the class of flash §10.29 guards against.
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  useEffect(() => {
    void listProfiles().then((profiles) => setProfile(mostRecentGoogleProfile(profiles)))
  }, [])

  const name = profile?.label ?? ''
  const firstName = name ? firstNameOf(name) : ''
  // `accountKey` is the OIDC `sub` on every live session (authStore.ts) —
  // shown only when it happens to look like an email (a legacy/cached
  // profile keyed on one) rather than ever displaying a raw numeric id as
  // if it were one.
  const email = profile?.accountKey?.includes('@') ? profile.accountKey : null

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
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
              <p className="truncate text-xs font-medium text-fg-tertiary">{email}</p>
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
        <button
          type="button"
          onClick={() => setGuestConfirmOpen(true)}
          disabled={busy}
          className="flex h-14 items-center justify-center rounded-2xl border border-border-subtle bg-transparent text-base font-bold text-foreground transition-opacity disabled:opacity-60"
        >
          {t('return.guestCta')}
        </button>
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
      />
    </main>
  )
}
