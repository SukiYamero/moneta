import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ProfileRecord } from '@/lib/profiles'

vi.mock('@/lib/sync/erase', () => ({
  eraseProfileData: vi.fn(),
  EraseError: class EraseError extends Error {
    stage: 'drive' | 'local'
    constructor(stage: 'drive' | 'local') {
      super(`erase: ${stage}`)
      this.name = 'EraseError'
      this.stage = stage
    }
  },
}))
vi.mock('@/lib/sync/syncSession', () => ({ getSyncContext: vi.fn() }))
vi.mock('@/lib/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAuthStore } from '@/lib/authStore'
import { useDataStore } from '@/lib/dataStore'
import { EraseError, eraseProfileData } from '@/lib/sync/erase'
import { getSyncContext } from '@/lib/sync/syncSession'
import { toast } from '@/lib/toastStore'
import { useDataErase } from '@/features/profile/useDataErase'

const mEraseProfileData = vi.mocked(eraseProfileData)
const mGetSyncContext = vi.mocked(getSyncContext)
const mToastSuccess = vi.mocked(toast.success)
const mToastError = vi.mocked(toast.error)

const profile: ProfileRecord = {
  id: 'p1',
  label: 'Test',
  kind: 'google',
  databaseName: 'kurobello-p1',
  createdAt: '2026-08-01T00:00:00.000Z',
  lastUsedAt: '2026-08-01T00:00:00.000Z',
}

const originalAuthState = useAuthStore.getState()
const originalDataState = useDataStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState(originalAuthState, true)
  useDataStore.setState(originalDataState, true)
  mGetSyncContext.mockResolvedValue({ token: 'tok', profile, locale: 'es' })
})

afterEach(() => {
  useAuthStore.setState(originalAuthState, true)
  useDataStore.setState(originalDataState, true)
})

describe('useDataErase', () => {
  it('is unavailable for a guest or an account without Drive connected', () => {
    useAuthStore.setState({ status: 'guest', drive: null })
    const { result: guestResult } = renderHook(() => useDataErase())
    expect(guestResult.current.driveAvailable).toBe(false)

    useAuthStore.setState({ status: 'authenticated', drive: null })
    const { result: noDriveResult } = renderHook(() => useDataErase())
    expect(noDriveResult.current.driveAvailable).toBe(false)
  })

  it('is available once authenticated with Drive connected', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    const { result } = renderHook(() => useDataErase())
    expect(result.current.driveAvailable).toBe(true)
  })

  it('requestErase opens the confirm dialog only when Drive is available', () => {
    useAuthStore.setState({ status: 'guest', drive: null })
    const { result } = renderHook(() => useDataErase())

    act(() => result.current.requestErase())

    expect(result.current.confirmOpen).toBe(false)
  })

  it('confirmErase runs the erase, resets and reloads dataStore, and toasts success', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mEraseProfileData.mockResolvedValue(undefined)
    const loadSpy = vi.spyOn(useDataStore.getState(), 'load').mockResolvedValue(undefined)
    const resetSpy = vi.spyOn(useDataStore.getState(), 'reset')
    const { result } = renderHook(() => useDataErase())
    act(() => result.current.requestErase())
    expect(result.current.confirmOpen).toBe(true)

    await act(async () => result.current.confirmErase())

    expect(mEraseProfileData).toHaveBeenCalledWith('tok', profile)
    expect(resetSpy).toHaveBeenCalledOnce()
    expect(loadSpy).toHaveBeenCalledOnce()
    expect(mToastSuccess).toHaveBeenCalledWith('profile:data.deleteStored.success')
    expect(result.current.confirmOpen).toBe(false)
    expect(result.current.erasing).toBe(false)
  })

  it('surfaces a drive-stage failure with the drive-specific toast, never a success toast', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mEraseProfileData.mockRejectedValue(new EraseError('drive', new Error('boom')))
    const { result } = renderHook(() => useDataErase())
    act(() => result.current.requestErase())

    await act(async () => result.current.confirmErase())

    expect(mToastError).toHaveBeenCalledWith('profile:data.deleteStored.failedDrive')
    expect(mToastSuccess).not.toHaveBeenCalled()
  })

  it('surfaces a local-stage failure with the local-specific toast, never a success toast', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mEraseProfileData.mockRejectedValue(new EraseError('local', new Error('boom')))
    const { result } = renderHook(() => useDataErase())
    act(() => result.current.requestErase())

    await act(async () => result.current.confirmErase())

    expect(mToastError).toHaveBeenCalledWith('profile:data.deleteStored.failedLocal')
    expect(mToastSuccess).not.toHaveBeenCalled()
  })

  it('falls back to the generic failure toast for a non-EraseError rejection', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mEraseProfileData.mockRejectedValue(new Error('unexpected'))
    const { result } = renderHook(() => useDataErase())
    act(() => result.current.requestErase())

    await act(async () => result.current.confirmErase())

    expect(mToastError).toHaveBeenCalledWith('profile:data.deleteStored.failed')
  })

  it('does not attempt to erase, and reports it, if no sync context can be resolved', async () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    mGetSyncContext.mockResolvedValue(null)
    const { result } = renderHook(() => useDataErase())
    act(() => result.current.requestErase())

    await act(async () => result.current.confirmErase())

    expect(mEraseProfileData).not.toHaveBeenCalled()
    expect(mToastError).toHaveBeenCalledWith('profile:data.deleteStored.failedDrive')
  })

  it('cancelErase closes the dialog without erasing', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    const { result } = renderHook(() => useDataErase())
    act(() => result.current.requestErase())

    act(() => result.current.cancelErase())

    expect(result.current.confirmOpen).toBe(false)
    expect(mEraseProfileData).not.toHaveBeenCalled()
  })
})
