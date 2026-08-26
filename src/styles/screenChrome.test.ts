import { describe, expect, it } from 'vitest'
import indexCss from '@/styles/index.css?raw'
import indexHtml from '../../index.html?raw'
// oxlint's import/default doesn't know Vite's `?raw` loader turns the
// request into a virtual module whose default export is the source text.
// oxlint-disable-next-line import/default
import homeSource from '@/routes/Home.tsx?raw'
// oxlint-disable-next-line import/default
import searchSource from '@/features/search/SearchScreen.tsx?raw'
// oxlint-disable-next-line import/default
import historySource from '@/features/history/HistoryScreen.tsx?raw'
// oxlint-disable-next-line import/default
import settingsSource from '@/features/settings/SettingsScreen.tsx?raw'
// oxlint-disable-next-line import/default
import preContentSkeletonSource from '@/features/boot/PreContentSkeleton.tsx?raw'
// oxlint-disable-next-line import/default
import welcomeScreenSource from '@/features/auth/WelcomeScreen.tsx?raw'

const SCREEN_INSET_CLASS = 'pt-(--screen-inset-top)'

describe('the shared screen top-inset standard', () => {
  it('defines --screen-inset-top as a floor topped up with env(safe-area-inset-top), not a bare constant', () => {
    const declaration = indexCss.match(/--screen-inset-top:[^;]+;/)?.[0] ?? ''
    expect(declaration).not.toBe('')
    expect(declaration).toContain('env(safe-area-inset-top)')
    expect(declaration).toMatch(/\bmax\(/)
    expect(declaration).toContain('0rem')
  })

  it.each([
    ['Home', homeSource],
    ['SearchScreen', searchSource],
    ['HistoryScreen', historySource],
    ['SettingsScreen', settingsSource],
    ['PreContentSkeleton (mirrors Home)', preContentSkeletonSource],
  ])('%s opts into the shared token instead of a hand-typed pt-*', (_name, source) => {
    expect(source).toContain(SCREEN_INSET_CLASS)
    expect(source).not.toMatch(/\bpt-(2|6|14)\b/)
  })
})

describe('zoom is disabled app-wide', () => {
  it('index.html disables pinch-zoom via the viewport meta', () => {
    expect(indexHtml).toMatch(/maximum-scale=1\.0/)
    expect(indexHtml).toMatch(/user-scalable=no/)
  })

  it('index.css disables double-tap-to-zoom via touch-action', () => {
    expect(indexCss).toMatch(/touch-action:\s*manipulation/)
  })
})

describe('WelcomeScreen never sizes itself against the raw viewport from inside the padded body', () => {
  it('uses min-h-full, not min-h-dvh, so it can never demand more room than body already allotted it', () => {
    // Matched only inside a className attribute — the fix's own explanatory
    // comment legitimately still says "min-h-dvh" in prose, to name what it
    // replaced.
    expect(welcomeScreenSource).toMatch(/className="[^"]*\bmin-h-full\b[^"]*"/)
    expect(welcomeScreenSource).not.toMatch(/className="[^"]*\bmin-h-dvh\b[^"]*"/)
  })
})
