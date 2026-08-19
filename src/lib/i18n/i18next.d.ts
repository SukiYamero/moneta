import 'i18next'
import type es from '@/lib/i18n/locales/es.json'

// `es` is base and fallback (docs/wave-2-plan.md, Track I), so it is the
// shape every key access is checked against — `t('does.not.exist')` is a
// compile error, and every other locale file is typed to match the same shape.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: typeof es
  }
}
