import { detectLocale } from '@/lib/i18n/detectLocale'
import type { SupportedLocale } from '@/lib/i18n/resources'

/**
 * A stored `idioma` wins over the detected device locale; absence — never
 * having chosen one, or having explicitly chosen "seguir el dispositivo",
 * which writes it back to `undefined` — means "follow the device"
 * (specs.md §10.24 Prerequisite 2). Pure and parameterized (`languages`
 * forwarded to `detectLocale`, no default) so it stays independently
 * testable, the same judgment `specs.md` §11 (2026-08-19) already applies
 * to every other locale-parameter call site.
 */
export const resolveActiveLocale = (
  stored: SupportedLocale | undefined,
  languages?: readonly string[],
): SupportedLocale => stored ?? detectLocale(languages)
