import { useTranslation } from 'react-i18next'

// Minimal, honest placeholder — Track E4 (Wave 2 stage 3) replaces the body.
// Named export `HistoryScreen`, no props: that is the stable contract E4
// builds against (src/router.tsx only imports the name, never its
// internals). Design source (line ~196): the history screen animates in
// with `mnPushIn .28s cubic-bezier(.32,.72,0,1)`, matched here by the
// existing `animate-push-in` token (AGENTS.md § UI). No back affordance:
// BottomNav (rendered once by AppShell, persistent across all three tabs)
// is how you return to Home, not a per-screen back link — History is a
// sibling tab, not a modal pushed on top of it.
export const HistoryScreen = () => {
  const { t } = useTranslation('history')

  return (
    <main className="flex min-h-full animate-push-in flex-col px-5 pt-6">
      <h1 className="text-5xl font-extrabold tracking-tight text-balance">{t('title')}</h1>
      <p className="pt-6 text-sm text-muted-foreground">{t('placeholder')}</p>
    </main>
  )
}
