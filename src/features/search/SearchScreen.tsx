import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

// Minimal, honest placeholder — Track E3 (Wave 2 stage 3) replaces the body.
// Named export `SearchScreen`, no props: that is the stable contract E3
// builds against (src/router.tsx only imports the name, never its internals).
export const SearchScreen = () => {
  const { t } = useTranslation('search')
  const { t: tCommon } = useTranslation('common')

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
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
