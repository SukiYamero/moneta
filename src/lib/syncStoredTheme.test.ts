import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDataStore } from '@/lib/dataStore'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { syncStoredTheme } from '@/lib/syncStoredTheme'
import { THEME_STORAGE_KEY } from '@/lib/theme'

const stubMatchMedia = (matches: boolean) => {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  const mql = {
    matches,
    addEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
      listeners.delete(listener)
    },
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => mql),
  )
  return {
    change: (next: boolean) => {
      mql.matches = next
      for (const listener of listeners) listener({ matches: next })
    },
  }
}

afterEach(() => {
  useDataStore.setState({ config: null })
  document.documentElement.classList.remove('dark')
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('syncStoredTheme', () => {
  it('applies and mirrors a stored tema once Config resolves', async () => {
    stubMatchMedia(false)
    syncStoredTheme()
    useDataStore.setState({
      config: {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, tema: 'oscuro' },
      },
    })
    await Promise.resolve()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('oscuro')
  })

  it('does not react when an unrelated field changes', async () => {
    stubMatchMedia(false)
    syncStoredTheme()
    useDataStore.setState({ config: CONFIG_SEMILLA })
    await Promise.resolve()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    useDataStore.setState((state) => ({
      config: state.config && {
        ...state.config,
        preferencias: { ...state.config.preferencias, monedaPrincipal: 'USD' },
      },
    }))
    await Promise.resolve()
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('follows a live prefers-color-scheme change while tema is sistema', async () => {
    const media = stubMatchMedia(false)
    syncStoredTheme()
    useDataStore.setState({
      config: {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, tema: 'sistema' },
      },
    })
    await Promise.resolve()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    media.change(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('ignores a live prefers-color-scheme change when tema is not sistema', async () => {
    const media = stubMatchMedia(false)
    syncStoredTheme()
    useDataStore.setState({
      config: {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, tema: 'claro' },
      },
    })
    await Promise.resolve()

    media.change(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
