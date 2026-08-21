import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, persistTheme, resolveTheme, systemTheme, THEME_STORAGE_KEY } from '@/lib/theme'

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
  localStorage.clear()
})

const stubMatchMedia = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('systemTheme', () => {
  it('reads oscuro when the OS prefers dark', () => {
    stubMatchMedia(true)
    expect(systemTheme()).toBe('oscuro')
  })

  it('reads claro when the OS prefers light', () => {
    stubMatchMedia(false)
    expect(systemTheme()).toBe('claro')
  })

  it('degrades to claro when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemTheme()).toBe('claro')
  })
})

describe('resolveTheme', () => {
  it('passes an explicit claro/oscuro through unchanged', () => {
    expect(resolveTheme('claro')).toBe('claro')
    expect(resolveTheme('oscuro')).toBe('oscuro')
  })

  it('resolves sistema via the OS preference', () => {
    stubMatchMedia(true)
    expect(resolveTheme('sistema')).toBe('oscuro')
  })
})

describe('applyTheme', () => {
  it('adds the .dark class for oscuro', () => {
    applyTheme('oscuro')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the .dark class for claro', () => {
    document.documentElement.classList.add('dark')
    applyTheme('claro')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('updates the theme-color meta tag to match', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.append(meta)
    applyTheme('claro')
    expect(meta.getAttribute('content')).toBe('#f4f3ef')
    applyTheme('oscuro')
    expect(meta.getAttribute('content')).toBe('#0c0d10')
    meta.remove()
  })
})

describe('persistTheme', () => {
  it('mirrors tema under THEME_STORAGE_KEY', () => {
    persistTheme('claro')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('claro')
  })

  it('swallows a storage failure rather than throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => persistTheme('oscuro')).not.toThrow()
    spy.mockRestore()
  })
})
