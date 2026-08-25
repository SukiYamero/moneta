import { describe, expect, it } from 'vitest'
import indexCss from '@/styles/index.css?raw'
import indexHtml from '../../index.html?raw'
// oxlint's import/default resolves each `?raw` request against the real
// .tsx file and (correctly, for the file itself) finds no default export —
// it doesn't know Vite's `?raw` loader turns the request into a virtual
// module whose default export is the file's source text. A genuine false
// positive per AGENTS.md, suppressed at each site rather than disabling the
// rule project-wide.
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

/**
 * Pins the shell standard specs.md §10.34 records: one shared top-inset
 * token, not four (five, counting `PreContentSkeleton`) hand-typed pt-*
 * values with no source of truth. `?raw` (same pattern as
 * `themeBootScript.test.ts`) reads each file as a source string rather than
 * rendering it, because that is the honest shape available here: jsdom
 * doesn't evaluate CSS custom properties or `env()`, so no test run in this
 * suite can prove the token resolves to the right *pixel* value in a real
 * browser, on a real notch, or that the four screens visually line up —
 * that was checked directly in a real browser instead (this track's own
 * report says what was and wasn't verified that way). What this test *can*
 * prove, and is honestly scoped to: the token is defined with the shape the
 * standard requires, and every screen that must use it still does — so a
 * future edit that quietly reverts one screen back to a hardcoded pt-*
 * fails immediately, which is the whole point of "pinning" a standard.
 */
describe('the shared screen top-inset standard (specs.md §10.34)', () => {
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

describe('zoom is disabled app-wide (specs.md §10.34; specs.md §11, 2026-08-24)', () => {
  it('index.html disables pinch-zoom via the viewport meta', () => {
    expect(indexHtml).toMatch(/maximum-scale=1\.0/)
    expect(indexHtml).toMatch(/user-scalable=no/)
  })

  it('index.css disables double-tap-to-zoom via touch-action, and no longer claims it in a comment it does not back', () => {
    expect(indexCss).toMatch(/touch-action:\s*manipulation/)
  })
})

describe('WelcomeScreen never sizes itself against the raw viewport from inside the padded body (specs.md §10.34)', () => {
  it('uses min-h-full, not min-h-dvh, so it can never demand more room than body already allotted it', () => {
    // Matched only inside a className attribute — the fix's own explanatory
    // comment legitimately still says "min-h-dvh" in prose, to name what it
    // replaced.
    expect(welcomeScreenSource).toMatch(/className="[^"]*\bmin-h-full\b[^"]*"/)
    expect(welcomeScreenSource).not.toMatch(/className="[^"]*\bmin-h-dvh\b[^"]*"/)
  })
})
