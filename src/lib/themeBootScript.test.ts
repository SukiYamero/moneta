import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/theme'

describe('index.html boot script', () => {
  it('reads the same localStorage key theme.ts writes', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  it('corrects meta[name=theme-color] to the same hex values theme.ts uses', () => {
    expect(indexHtml).toContain(`'${THEME_COLOR.oscuro}'`)
    expect(indexHtml).toContain(`'${THEME_COLOR.claro}'`)
  })
})
