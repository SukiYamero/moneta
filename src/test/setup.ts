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
beforeAll(async () => {
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
