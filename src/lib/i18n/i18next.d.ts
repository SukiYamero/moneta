import 'i18next'
import type es from '@/lib/i18n/locales/es.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: typeof es
  }
}
