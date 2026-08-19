import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverCsv } from '@/lib/export/delivery'

const CSV_PARTS = ['﻿sep=;\r\n', 'id;fecha\r\n', 'm1;2026-08-15\r\n']

interface DownloadCapture {
  href: string
  download: string
}

let downloadCapture: DownloadCapture | undefined
let createObjectURLSpy: ReturnType<typeof vi.fn>
let revokeObjectURLSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  downloadCapture = undefined
  createObjectURLSpy = vi.fn(() => 'blob:mock-url')
  revokeObjectURLSpy = vi.fn()
  // jsdom doesn't implement createObjectURL/revokeObjectURL at all.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: createObjectURLSpy,
    revokeObjectURL: revokeObjectURLSpy,
  })
  // The anchor is removed from the DOM synchronously right after click(), so
  // the only place to observe its attributes is from inside the click spy
  // itself, while it's still attached — querying via the DOM (not `this`,
  // which an arrow function can't bind) keeps this an arrow function.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    const anchor = document.querySelector('a[download]')
    if (anchor) {
      downloadCapture = {
        href: anchor.getAttribute('href') ?? '',
        download: anchor.getAttribute('download') ?? '',
      }
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('deliverCsv()', () => {
  it('falls back to a download link when navigator.share is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })

    await deliverCsv({ filename: 'movimientos.csv', parts: CSV_PARTS })

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(downloadCapture).toEqual({ href: 'blob:mock-url', download: 'movimientos.csv' })
  })

  it('defers URL.revokeObjectURL past the click task, so it cannot race the browser reading the blob (iOS Safari hazard)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })

    await deliverCsv({ filename: 'movimientos.csv', parts: CSV_PARTS })

    expect(revokeObjectURLSpy).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('falls back to a download link when the platform cannot share this file (canShare returns false)', async () => {
    const share = vi.fn()
    const canShare = vi.fn(() => false)
    vi.stubGlobal('navigator', { ...navigator, share, canShare })

    await deliverCsv({ filename: 'movimientos.csv', parts: CSV_PARTS })

    expect(share).not.toHaveBeenCalled()
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
  })

  it('uses navigator.share, not the download link, when the platform can share the file', async () => {
    const share = vi.fn((_data: ShareData) => Promise.resolve())
    const canShare = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, share, canShare })

    await deliverCsv({ filename: 'movimientos.csv', parts: CSV_PARTS })

    expect(share).toHaveBeenCalledTimes(1)
    const [{ files }] = share.mock.calls[0]!
    expect(files).toHaveLength(1)
    expect(files![0]!.name).toBe('movimientos.csv')
    expect(files![0]!.type).toBe('text/csv;charset=utf-8')
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('treats the user dismissing the share sheet (AbortError) as success, not a failure requiring a fallback', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancelled', 'AbortError')))
    const canShare = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, share, canShare })

    await expect(
      deliverCsv({ filename: 'movimientos.csv', parts: CSV_PARTS }),
    ).resolves.toBeUndefined()

    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('falls back to the download link if navigator.share rejects for a reason other than cancellation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const share = vi.fn(() => Promise.reject(new Error('share target failed')))
    const canShare = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, share, canShare })

    await deliverCsv({ filename: 'movimientos.csv', parts: CSV_PARTS })

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()
  })
})
