import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/lib/toastStore'

vi.mock('@/lib/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Fake `registerSW`, shaped exactly like `virtual:pwa-register`'s real
// export, that lets each test drive the SW lifecycle callbacks directly
// instead of needing a real service worker or a mocked virtual module.
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

    expect(toast.success).toHaveBeenCalledExactlyOnceWith('update:available')
    expect(toast.error).not.toHaveBeenCalled()
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

    // This module doesn't suppress the second call itself — toastStore's own
    // duplicate-collapse (same variant + message) is what prevents nagging,
    // so both calls reaching toast.success with the identical key is correct.
    expect(toast.success).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenNthCalledWith(1, 'update:available')
    expect(toast.success).toHaveBeenNthCalledWith(2, 'update:available')
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

    it('a failed periodic check is swallowed — offline is not an error (specs.md §10.16)', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const update = vi.fn(() => Promise.reject(new Error('offline')))

      fake.options().onRegisteredSW?.('sw.js', fakeRegistration(update))

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(update).toHaveBeenCalledOnce()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('does not schedule a check when no registration is handed back', async () => {
      const { createSwUpdateController } = await import('@/lib/swUpdate')
      const fake = createFakeRegisterSW()
      createSwUpdateController(fake.registerSW)
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      fake.options().onRegisteredSW?.('sw.js', undefined)

      expect(setIntervalSpy).not.toHaveBeenCalled()
    })
  })
})

describe('initServiceWorkerUpdates / applyServiceWorkerUpdate (the real virtual module)', () => {
  it('registers without throwing and is idempotent', async () => {
    const { initServiceWorkerUpdates } = await import('@/lib/swUpdate')
    expect(() => initServiceWorkerUpdates()).not.toThrow()
    expect(() => initServiceWorkerUpdates()).not.toThrow()
  })

  it('applying before (or without) a registered controller resolves rather than throwing', async () => {
    vi.resetModules()
    const { applyServiceWorkerUpdate } = await import('@/lib/swUpdate')
    await expect(applyServiceWorkerUpdate()).resolves.toBeUndefined()
  })
})
