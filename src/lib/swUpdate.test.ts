import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/lib/toastStore'

vi.mock('@/lib/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

interface FakeRegisterSWOptions {
  onNeedRefresh?: () => void
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void
  onRegisterError?: (error: unknown) => void
}

const createFakeRegisterSW = () => {
  const updateServiceWorker = vi.fn(async () => {})
  let capturedOptions: FakeRegisterSWOptions = {}
  const registerSW = vi.fn((options: FakeRegisterSWOptions) => {
    capturedOptions = options
    return updateServiceWorker
  })
  return {
    registerSW,
    updateServiceWorker,
    options: () => capturedOptions,
  }
}

const fakeRegistration = (update: () => Promise<unknown>) =>
  ({ update }) as unknown as ServiceWorkerRegistration

describe('createSwUpdateController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('produces the update-available toast when the SW reports a waiting version', async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const fake = createFakeRegisterSW()
    createSwUpdateController(fake.registerSW)

    fake.options().onNeedRefresh?.()

    expect(toast.success).toHaveBeenCalledExactlyOnceWith('update:available', undefined, {
      labelKey: 'update:reload',
      onAction: expect.any(Function),
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("taking the toast action applies this controller's own injected updateServiceWorker, not a different one", async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const fake = createFakeRegisterSW()
    createSwUpdateController(fake.registerSW)

    fake.options().onNeedRefresh?.()
    const action = vi.mocked(toast.success).mock.calls[0]?.[2]
    action?.onAction()
    await Promise.resolve()

    expect(fake.updateServiceWorker).toHaveBeenCalledOnce()
  })

  it('a toast action failure is caught and logged, not left to float unhandled', async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fake = createFakeRegisterSW()
    const applyError = new Error('update failed')
    fake.updateServiceWorker.mockRejectedValueOnce(applyError)
    createSwUpdateController(fake.registerSW)

    fake.options().onNeedRefresh?.()
    const action = vi.mocked(toast.success).mock.calls[0]?.[2]
    action?.onAction()
    await Promise.resolve()
    await Promise.resolve()

    expect(warnSpy).toHaveBeenCalledWith(
      'sw update: failed to apply the waiting update',
      applyError,
    )
    warnSpy.mockRestore()
  })

  it('taking the prompt applies the waiting worker cleanly', async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const fake = createFakeRegisterSW()
    const controller = createSwUpdateController(fake.registerSW)

    fake.options().onNeedRefresh?.()
    await controller.applyUpdate()

    expect(fake.updateServiceWorker).toHaveBeenCalledOnce()
  })

  it('does not apply an update on its own — only a caller invoking applyUpdate does', async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const fake = createFakeRegisterSW()
    createSwUpdateController(fake.registerSW)

    fake.options().onNeedRefresh?.()

    expect(fake.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('a repeated onNeedRefresh call (e.g. a later periodic check) re-raises rather than stacking, via toastStore', async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const fake = createFakeRegisterSW()
    createSwUpdateController(fake.registerSW)

    fake.options().onNeedRefresh?.()
    fake.options().onNeedRefresh?.()

    expect(toast.success).toHaveBeenCalledTimes(2)
    const expectedAction = { labelKey: 'update:reload', onAction: expect.any(Function) }
    expect(toast.success).toHaveBeenNthCalledWith(1, 'update:available', undefined, expectedAction)
    expect(toast.success).toHaveBeenNthCalledWith(2, 'update:available', undefined, expectedAction)
  })

  it('logs a registration failure without toasting it', async () => {
    const { createSwUpdateController } = await import('@/lib/swUpdate')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fake = createFakeRegisterSW()
    createSwUpdateController(fake.registerSW)

    const registerError = new Error('registration failed')
    fake.options().onRegisterError?.(registerError)

    expect(warnSpy).toHaveBeenCalledWith(
      'sw update: service worker registration failed',
      registerError,
    )
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  describe('periodic update checks', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('polls registration.update() hourly once a registration is available', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const update = vi.fn(async () => {})

      fake.options().onRegisteredSW?.('sw.js', fakeRegistration(update))
      expect(update).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(update).toHaveBeenCalledOnce()

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(update).toHaveBeenCalledTimes(2)
    })

    it('a failed periodic check is swallowed from the user, but still logged', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const offlineError = new Error('offline')
      const update = vi.fn(() => Promise.reject(offlineError))

      fake.options().onRegisteredSW?.('sw.js', fakeRegistration(update))

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(update).toHaveBeenCalledOnce()
      expect(toast.error).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith('sw update: periodic check failed', offlineError)
      warnSpy.mockRestore()
    })

    it('does not schedule a check when no registration is handed back', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      fake.options().onRegisteredSW?.('sw.js', undefined)

      expect(setIntervalSpy).not.toHaveBeenCalled()
    })

    it('clears the periodic check on a genuine unload (pagehide, not persisted for bfcache)', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const update = vi.fn(async () => {})

      fake.options().onRegisteredSW?.('sw.js', fakeRegistration(update))
      window.dispatchEvent(new Event('pagehide'))

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(update).not.toHaveBeenCalled()
    })

    it('keeps the periodic check alive across a bfcache-eligible pagehide (event.persisted)', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const update = vi.fn(async () => {})

      fake.options().onRegisteredSW?.('sw.js', fakeRegistration(update))
      const persistedPagehide = new Event('pagehide')
      Object.defineProperty(persistedPagehide, 'persisted', { value: true })
      window.dispatchEvent(persistedPagehide)

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(update).toHaveBeenCalledOnce()
    })
  })
})

describe('initServiceWorkerUpdates / applyServiceWorkerUpdate (the real virtual module)', () => {
  it('registers without throwing and is idempotent', async () => {
    const { initServiceWorkerUpdates } = await import('@/lib/swUpdate')
    expect(() => initServiceWorkerUpdates()).not.toThrow()
    expect(() => initServiceWorkerUpdates()).not.toThrow()
  })

  it('applying before a registration exists rejects instead of resolving as if it had succeeded', async () => {
    vi.resetModules()
    const { applyServiceWorkerUpdate } = await import('@/lib/swUpdate')
    await expect(applyServiceWorkerUpdate()).rejects.toThrow(
      'applyServiceWorkerUpdate called before a service worker was registered',
    )
  })
})
