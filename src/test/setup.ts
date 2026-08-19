import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { i18next } from '@/lib/i18n'

// Tests must not depend on the runner's ambient locale (jsdom's default
// navigator.languages) — force `es` before the suite and after every test,
// so a test that changes locale never leaks into the next one.
beforeAll(async () => {
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
