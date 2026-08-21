import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * `index.html`'s inline pre-paint script (specs.md §10.30) can't import
 * `THEME_STORAGE_KEY` — it must run before the module graph loads — so it
 * duplicates the literal. This is the mechanical check that keeps the two
 * from silently drifting apart (AGENTS.md's "fix the shape" lesson): a
 * renamed key here without updating `index.html` would make every boot
 * read the wrong (or a nonexistent) localStorage entry, degrading straight
 * to the `sistema` fallback with no test failure to catch it otherwise.
 * `?raw` (Vite's generic raw-import, typed by `vite/client`) reads the file
 * as a string without going through `node:fs` — `tsconfig.app.json`
 * deliberately doesn't include Node's ambient types under `src/`.
 */
describe('index.html boot script', () => {
  it('reads the same localStorage key theme.ts writes', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`)
  })
})
