import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * `index.html`'s inline pre-paint script (specs.md §10.30) can't import
 * `THEME_STORAGE_KEY`/`THEME_COLOR` — it must run before the module graph
 * loads — so it duplicates the literals. This is the mechanical check that
 * keeps them from silently drifting apart (AGENTS.md's "fix the shape"
 * lesson): a renamed storage key here without updating `index.html` would
 * make every boot read the wrong (or a nonexistent) localStorage entry,
 * degrading straight to the `sistema` fallback with no test failure to
 * catch it otherwise; a changed `THEME_COLOR` hex without updating
 * `index.html` would leave the browser-chrome color wrong until
 * `applyTheme()` runs at runtime. `?raw` (Vite's generic raw-import, typed
 * by `vite/client`) reads the file as a string without going through
 * `node:fs` — `tsconfig.app.json` deliberately doesn't include Node's
 * ambient types under `src/`.
 */
describe('index.html boot script', () => {
  it('reads the same localStorage key theme.ts writes', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  it('corrects meta[name=theme-color] to the same hex values theme.ts uses', () => {
    expect(indexHtml).toContain(`'${THEME_COLOR.oscuro}'`)
    expect(indexHtml).toContain(`'${THEME_COLOR.claro}'`)
  })
})
