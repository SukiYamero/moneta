import type es from '@/lib/i18n/locales/es.json'

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
