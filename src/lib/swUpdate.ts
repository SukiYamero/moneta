/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'
import { toast } from '@/lib/toastStore'

interface RegisterSWDeps {
  onNeedRefresh?: () => void
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void
  onRegisterError?: (error: unknown) => void
}
type UpdateServiceWorker = () => Promise<void>
type RegisterSWFn = (options: RegisterSWDeps) => UpdateServiceWorker

export interface SwUpdateController {
  applyUpdate: () => Promise<void>
}

const PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000

export const createSwUpdateController = (registerSW: RegisterSWFn): SwUpdateController => {
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => {
      toast.success('update:available', undefined, {
        labelKey: 'update:reload',
        onAction: () => {
          updateServiceWorker().catch((error: unknown) => {
            console.warn('sw update: failed to apply the waiting update', error)
          })
        },
      })
    },
    onRegisteredSW: (_swScriptUrl, registration) => {
      if (!registration) return
      const intervalId = setInterval(() => {
        registration.update().catch((error: unknown) => {
          console.warn('sw update: periodic check failed', error)
        })
      }, PERIODIC_UPDATE_CHECK_MS)
      // pagehide over beforeunload: beforeunload is unreliable on mobile Safari,
      // and on browsers with bfcache, registering it opts the page out of caching.
      window.addEventListener('pagehide', (event) => {
        if (event.persisted) return
        clearInterval(intervalId)
      })
    },
    onRegisterError: (error) => {
      console.warn('sw update: service worker registration failed', error)
    },
  })

  return {
    applyUpdate: () => updateServiceWorker(),
  }
}

let controller: SwUpdateController | undefined

export const initServiceWorkerUpdates = (): void => {
  if (controller) return
  controller = createSwUpdateController(registerSW)
}

export const applyServiceWorkerUpdate = (): Promise<void> =>
  controller?.applyUpdate() ??
  Promise.reject(
    new Error('sw update: applyServiceWorkerUpdate called before a service worker was registered'),
  )
