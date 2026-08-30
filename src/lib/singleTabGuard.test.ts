import { afterEach, describe, expect, it, vi } from 'vitest'

type LockCallback = (lock: { name: string } | null) => Promise<void>

const importGuard = async (): Promise<typeof import('@/lib/singleTabGuard')> => {
  vi.resetModules()
  return import('@/lib/singleTabGuard')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('singleTabGuard', () => {
  it('starts and stays unsupported when navigator.locks does not exist, and init() is a no-op', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined })
    const { useSingleTabGuardStore } = await importGuard()

    expect(useSingleTabGuardStore.getState().phase).toBe('unsupported')
    await useSingleTabGuardStore.getState().init()
    expect(useSingleTabGuardStore.getState().phase).toBe('unsupported')
  })

  it('requests an exclusive lock scoped to this app and grants immediately when available', async () => {
    const request = vi.fn((_name: string, _opts: unknown, callback: LockCallback) => {
      void callback({ name: 'held' })
      return Promise.resolve()
    })
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    const { useSingleTabGuardStore, SINGLE_TAB_LOCK_NAME } = await importGuard()

    await useSingleTabGuardStore.getState().init()

    expect(useSingleTabGuardStore.getState().phase).toBe('granted')
    expect(request).toHaveBeenCalledWith(
      SINGLE_TAB_LOCK_NAME,
      { mode: 'exclusive', ifAvailable: true },
      expect.any(Function),
    )
  })

  it('blocks only once both the first attempt and the grace-period retry find the lock unavailable', async () => {
    vi.useFakeTimers()
    const request = vi.fn((_name: string, _opts: unknown, callback: LockCallback) => {
      void callback(null)
      return Promise.resolve()
    })
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    const { useSingleTabGuardStore } = await importGuard()

    const done = useSingleTabGuardStore.getState().init()
    await vi.advanceTimersByTimeAsync(300)
    await done

    expect(useSingleTabGuardStore.getState().phase).toBe('blocked')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('recovers during the grace-period retry, covering a plain refresh overlapping the old and new tab', async () => {
    vi.useFakeTimers()
    let call = 0
    const request = vi.fn((_name: string, _opts: unknown, callback: LockCallback) => {
      call += 1
      void callback(call === 1 ? null : { name: 'held' })
      return Promise.resolve()
    })
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    const { useSingleTabGuardStore } = await importGuard()

    const done = useSingleTabGuardStore.getState().init()
    await vi.advanceTimersByTimeAsync(300)
    await done

    expect(useSingleTabGuardStore.getState().phase).toBe('granted')
  })

  it('retry() re-attempts after being blocked and succeeds once the other tab has closed', async () => {
    vi.useFakeTimers()
    let unlocked = false
    const request = vi.fn((_name: string, _opts: unknown, callback: LockCallback) => {
      void callback(unlocked ? { name: 'held' } : null)
      return Promise.resolve()
    })
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    const { useSingleTabGuardStore } = await importGuard()

    const first = useSingleTabGuardStore.getState().init()
    await vi.advanceTimersByTimeAsync(300)
    await first
    expect(useSingleTabGuardStore.getState().phase).toBe('blocked')

    unlocked = true
    await useSingleTabGuardStore.getState().retry()
    expect(useSingleTabGuardStore.getState().phase).toBe('granted')
  })

  it('never issues a second concurrent lock request when init() runs twice before the first settles', async () => {
    let settle: (() => void) | undefined
    const request = vi.fn(
      (_name: string, _opts: unknown, callback: LockCallback) =>
        new Promise<void>((resolve) => {
          settle = () => {
            void callback({ name: 'held' })
            resolve()
          }
        }),
    )
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    const { useSingleTabGuardStore } = await importGuard()

    const a = useSingleTabGuardStore.getState().init()
    const b = useSingleTabGuardStore.getState().init()
    settle?.()
    await Promise.all([a, b])

    expect(request).toHaveBeenCalledTimes(1)
    expect(useSingleTabGuardStore.getState().phase).toBe('granted')
  })
})
