import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

// Minimal, honest placeholder — Track E4 (Wave 2 stage 3) replaces the body.
// Named export `HistoryScreen`, no props: that is the stable contract E4
// builds against (src/router.tsx only imports the name, never its internals).
// Design has History as a full-screen overlay from the bottom nav; it is a
// route (not overlay-state-on-Home) using `animate-push-in` so it reads as
// a native push (AGENTS.md § UI, docs/wave-2-plan.md Track L brief).
export const HistoryScreen = () => {
  const { t } = useTranslation('history')
  const { t: tCommon } = useTranslation('common')

  return (
    <main className="flex min-h-dvh animate-push-in flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 px-4 pt-4">
        <Link
          to="/"
          aria-label={tCommon('back')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-extrabold">{t('title')}</h1>
      </header>
      <p className="px-4 pt-6 text-sm text-muted-foreground">{t('placeholder')}</p>
    </main>
  )
}
