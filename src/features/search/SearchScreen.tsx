import { useTranslation } from 'react-i18next'

// Minimal, honest placeholder — Track E3 (Wave 2 stage 3) replaces the body.
// Named export `SearchScreen`, no props: that is the stable contract E3
// builds against (src/router.tsx only imports the name, never its
// internals). Design source: `mnFade .2s ease` (line ~353), matched by the
// existing `animate-fade-in` token — Search is a tab switch, not a push
// (History is; see HistoryScreen.tsx). No back affordance: BottomNav
// (rendered once by AppShell, persistent across all three tabs) is how you
// return to Home, not a per-screen back link.
export const SearchScreen = () => {
  const { t } = useTranslation('search')

  return (
    <main className="flex min-h-full animate-fade-in flex-col px-5 pt-6">
      <h1 className="text-5xl font-extrabold tracking-tight text-balance">{t('title')}</h1>
      <p className="pt-6 text-sm text-muted-foreground">{t('placeholder')}</p>
    </main>
  )
}
