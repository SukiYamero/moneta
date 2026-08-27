import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { i18next } from '@/lib/i18n'
import { MockResizeObserver } from '@/test/resizeObserverMock'

// jsdom defaults navigator.language(s) to en-US. Set via Object.defineProperty (not
// vi.stubGlobal) so it survives a test's own vi.stubGlobal('navigator')/unstubAllGlobals cycle.
const COARSE_POINTER_QUERY = '(pointer: coarse)'

// jsdom has no `matchMedia` at all.
const createMatchMedia = (query: string): MediaQueryList =>
  ({
    matches: query === COARSE_POINTER_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

beforeAll(async () => {
  window.matchMedia = createMatchMedia
  // jsdom has no `ResizeObserver` at all.
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
  Object.defineProperty(navigator, 'language', { value: 'es-CO', configurable: true })
  Object.defineProperty(navigator, 'languages', { value: ['es-CO'], configurable: true })
  await i18next.changeLanguage('es')
})

afterEach(async () => {
  cleanup()
  MockResizeObserver.instances = []
  await i18next.changeLanguage('es')
})

const isUint8Array = (v: unknown): v is Uint8Array =>
  Object.prototype.toString.call(v) === '[object Uint8Array]'

expect.addEqualityTesters([
  (a: unknown, b: unknown): boolean | undefined => {
    if (!isUint8Array(a) || !isUint8Array(b)) return undefined
    if (a.byteLength !== b.byteLength) return false
    return a.every((value, i) => value === b[i])
  },
])
