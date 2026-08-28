import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getActiveProfileBinding: vi.fn() }))

import { getActiveProfileBinding, type ProfileBinding } from '@/lib/repoProvider'
import { DEFAULT_PROFILE_DATABASE_NAME } from '@/lib/profiles/profileRegistry'
import { clearLocalDatabaseAndReload } from '@/lib/bootRecovery'

const mGetActiveProfileBinding = vi.mocked(getActiveProfileBinding)

beforeEach(() => {
  mGetActiveProfileBinding.mockReset()
  vi.stubGlobal('location', { ...window.location, reload: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('clearLocalDatabaseAndReload', () => {
  it('deletes the active profile database, closing it first, then reloads', async () => {
    const close = vi.fn()
    mGetActiveProfileBinding.mockReturnValue({
      database: { name: 'kurobello-p1', close },
    } as unknown as ProfileBinding)
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase')

    await clearLocalDatabaseAndReload()

    expect(close).toHaveBeenCalledOnce()
    expect(deleteSpy).toHaveBeenCalledWith('kurobello-p1')
    expect(window.location.reload).toHaveBeenCalledOnce()
  })

  it('falls back to the default profile database name when no profile is bound', async () => {
    mGetActiveProfileBinding.mockReturnValue(null)
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase')

    await clearLocalDatabaseAndReload()

    expect(deleteSpy).toHaveBeenCalledWith(DEFAULT_PROFILE_DATABASE_NAME)
    expect(window.location.reload).toHaveBeenCalledOnce()
  })

  it('still reloads, after logging, when the delete request fails', async () => {
    mGetActiveProfileBinding.mockReturnValue(null)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
      const target = new EventTarget()
      queueMicrotask(() => target.dispatchEvent(new Event('error')))
      return target as unknown as IDBOpenDBRequest
    })

    await clearLocalDatabaseAndReload()

    expect(consoleError).toHaveBeenCalledOnce()
    expect(window.location.reload).toHaveBeenCalledOnce()
  })
})
