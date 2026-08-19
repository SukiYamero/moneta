import type es from '@/lib/i18n/locales/es.json'

// Maps a raw AuthError/DriveError message (English, developer-facing —
// `auth.ts`/`drive.ts`) to a translation key in the `auth` namespace's
// `errors` group — never Spanish copy directly. The screen resolves it at
// the render site (`t(loginErrorCopy(error))`), same as every other string
// on these screens, so this table stays a plain, i18next-free, pure
// function: `docs/error-handling.md` §7's drift-guard tests below keep
// protecting a deterministic string→string map, not something that reads
// hidden global locale state.
// docs/error-handling.md §7: never render `.message` raw in the DOM — it's
// untranslated and can leak internals (e.g. "missing VITE_GOOGLE_CLIENT_ID").
// Keyed by message rather than a `RepoError`-style `.code`: neither
// `AuthError` nor `DriveError` carries one today (no caller needs to branch
// on more than pass/fail — docs/error-handling.md §1), so this table is the
// UI-layer's own, narrower mapping, not a repo-taxonomy `code` union.
// Only the messages worth a distinct, actionable key are listed; anything
// else (a dynamic `DriveError` like "list 403", an unrecognized OAuth
// `resp.error`) falls through to the generic key below it never has to name.
type AuthErrorKey = `errors.${keyof typeof es.auth.errors}`

const AUTH_ERROR_KEY: Record<string, AuthErrorKey> = {
  'auth: missing VITE_GOOGLE_CLIENT_ID': 'errors.missingClientId',
  'auth: GIS failed to load': 'errors.gisFailedToLoad',
  'auth: access_denied': 'errors.accessDenied',
  'auth: popup_closed': 'errors.popupClosed',
  'auth: popup_failed_to_open': 'errors.popupFailedToOpen',
}

const DEFAULT_LOGIN_KEY: AuthErrorKey = 'errors.loginDefault'
const DEFAULT_DRIVE_KEY: AuthErrorKey = 'errors.driveDefault'

export const loginErrorCopy = (message: string): AuthErrorKey => {
  return AUTH_ERROR_KEY[message] ?? DEFAULT_LOGIN_KEY
}

export const driveErrorCopy = (message: string): AuthErrorKey => {
  return AUTH_ERROR_KEY[message] ?? DEFAULT_DRIVE_KEY
}
