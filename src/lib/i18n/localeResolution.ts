import { detectLocale } from '@/lib/i18n/detectLocale'
import type { SupportedLocale } from '@/lib/i18n/resources'

export const resolveActiveLocale = (
  stored: SupportedLocale | undefined,
  languages?: readonly string[],
): SupportedLocale => stored ?? detectLocale(languages)
