// Maps a raw AuthError/DriveError message (English, developer-facing —
// `auth.ts`/`drive.ts`) to the Spanish copy a user actually sees.
// docs/error-handling.md §7: never render `.message` raw in the DOM — it's
// untranslated and can leak internals (e.g. "missing VITE_GOOGLE_CLIENT_ID").
// Keyed by message rather than a `RepoError`-style `.code`: neither
// `AuthError` nor `DriveError` carries one today (no caller needs to branch
// on more than pass/fail — docs/error-handling.md §1), so this table is the
// UI-layer's own, narrower mapping, not a repo-taxonomy `code` union.
// Only the messages worth a distinct, actionable line are listed; anything
// else (a dynamic `DriveError` like "list 403", an unrecognized OAuth
// `resp.error`) falls through to the generic line below it never has to
// name.
const AUTH_ERROR_COPY: Record<string, string> = {
  'auth: missing VITE_GOOGLE_CLIENT_ID': 'Error de configuración. Intenta más tarde.',
  'auth: GIS failed to load': 'No pudimos cargar Google. Revisa tu conexión e intenta de nuevo.',
  'auth: access_denied': 'Cancelaste el inicio de sesión con Google.',
  'auth: popup_closed': 'Cerraste la ventana de Google antes de terminar. Intenta de nuevo.',
  'auth: popup_failed_to_open':
    'El navegador bloqueó la ventana de Google. Revisa el bloqueador de ventanas emergentes.',
}

const DEFAULT_LOGIN_COPY = 'No se pudo iniciar sesión. Intenta de nuevo.'
const DEFAULT_DRIVE_COPY = 'No se pudo conectar con Drive. Intenta de nuevo.'

export const loginErrorCopy = (message: string): string => {
  return AUTH_ERROR_COPY[message] ?? DEFAULT_LOGIN_COPY
}

export const driveErrorCopy = (message: string): string => {
  return AUTH_ERROR_COPY[message] ?? DEFAULT_DRIVE_COPY
}
