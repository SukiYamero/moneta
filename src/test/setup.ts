import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { i18next } from '@/lib/i18n'

// Tests must not depend on the runner's ambient locale (jsdom's default
// navigator.languages) — force `es` before the suite and after every test,
// so a test that changes locale never leaks into the next one. Same reason
// for `navigator.language`/`navigator.languages`: jsdom defaults to
// `en-US`, which would make every region-aware test (`detectRegion`,
// `useLocaleFormatting`) depend on the runner rather than the device. Set
// via `Object.defineProperty` on the real `navigator` object (not
// `vi.stubGlobal`) so it survives a test file's own
// `vi.stubGlobal('navigator', ...)` / `vi.unstubAllGlobals()` cycle —
// `unstubAllGlobals` restores `globalThis.navigator` to this same mutated
// object, not to jsdom's original `en-US` one. `es-CO` matches the
// pre-region-awareness baseline every existing test was written against.
const COARSE_POINTER_QUERY = '(pointer: coarse)'

// jsdom has no `matchMedia` at all, which every `useMediaQuery`-based hook
// (landscape, reduced-motion, theme, the amount pad's coarse-pointer gate)
// degrades on to "doesn't match" — silently hiding touch-only behavior from
// the whole suite. Query-aware rather than `matches: true` for everything:
// this project is mobile-first, so the suite defaults to a
// touch device by matching only `(pointer: coarse)`, false for every other
// query (`prefers-reduced-motion`, `prefers-color-scheme`, orientation).
// A test that needs a different device stubs `matchMedia` itself
// (`vi.stubGlobal`), which restores to this default afterward.
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
  Object.defineProperty(navigator, 'language', { value: 'es-CO', configurable: true })
  Object.defineProperty(navigator, 'languages', { value: ['es-CO'], configurable: true })
  await i18next.changeLanguage('es')
})

afterEach(async () => {
  cleanup()
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
