import '@testing-library/jest-dom/vitest'
import { afterEach, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'

afterEach(() => {
  cleanup()
})

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

const isUint8Array = (v: unknown): v is Uint8Array =>
  Object.prototype.toString.call(v) === '[object Uint8Array]'

expect.addEqualityTesters([
  function uint8ArraysEqual(a: unknown, b: unknown): boolean | undefined {
    if (!isUint8Array(a) || !isUint8Array(b)) return undefined
    if (a.byteLength !== b.byteLength) return false
    return a.every((value, i) => value === b[i])
  },
])
