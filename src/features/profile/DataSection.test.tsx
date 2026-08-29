import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoError } from '@/lib/repo'
import { toast } from '@/lib/toastStore'
import { useAuthStore } from '@/lib/authStore'
import { useDataStore } from '@/lib/dataStore'
import type { ProfileRecord } from '@/lib/profiles'
import type { Movimiento } from '@/lib/schema'

const exportMovimientosToCsv = vi.fn()
vi.mock('@/lib/export', () => ({
  exportMovimientosToCsv: (...args: unknown[]) => exportMovimientosToCsv(...args),
}))

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

import { EraseError, eraseProfileData } from '@/lib/sync/erase'
import { getSyncContext } from '@/lib/sync/syncSession'
import { DataSection } from '@/features/profile/DataSection'

const mEraseProfileData = vi.mocked(eraseProfileData)
const mGetSyncContext = vi.mocked(getSyncContext)

const profile: ProfileRecord = {
  id: 'p1',
  label: 'Test',
  kind: 'google',
  databaseName: 'kurobello-p1',
  createdAt: '2026-08-01T00:00:00.000Z',
  lastUsedAt: '2026-08-01T00:00:00.000Z',
}

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  fecha: '2026-08-01',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const originalAuthState = useAuthStore.getState()
const originalDataState = useDataStore.getState()

beforeEach(() => {
  useAuthStore.setState(originalAuthState, true)
  useDataStore.setState(originalDataState, true)
  mGetSyncContext.mockResolvedValue({ token: 'tok', profile, locale: 'es' })
})

describe('DataSection', () => {
  it('calls exportMovimientosToCsv with the active locale on tap', async () => {
    exportMovimientosToCsv.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<DataSection />)
    await user.click(screen.getByRole('button', { name: /exportar movimientos/i }))
    expect(exportMovimientosToCsv).toHaveBeenCalledWith({ locale: 'es-CO' })
  })

  it('shows a busy label and disables the button while exporting', async () => {
    let resolveExport: () => void = () => {}
    exportMovimientosToCsv.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve
      }),
    )
    const user = userEvent.setup()
    render(<DataSection />)
    await user.click(screen.getByRole('button', { name: /exportar movimientos/i }))

    const button = await screen.findByRole('button', { name: /exportando/i })
    expect(button).toBeDisabled()

    resolveExport()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /exportar movimientos/i })).not.toBeDisabled(),
    )
  })

  it('routes a RepoError to the same copy Home/Search/History already show for that code', async () => {
    exportMovimientosToCsv.mockRejectedValue(new RepoError('boom', 'network'))
    const toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<DataSection />)
    await user.click(screen.getByRole('button', { name: /exportar movimientos/i }))

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith('home:error.codes.network'))
    toastSpy.mockRestore()
  })

  it('falls back to a generic export-failed toast for a non-RepoError failure', async () => {
    exportMovimientosToCsv.mockRejectedValue(new Error('share sheet exploded'))
    const toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<DataSection />)
    await user.click(screen.getByRole('button', { name: /exportar movimientos/i }))

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith('profile:data.exportFailed'))
    toastSpy.mockRestore()
  })

  describe('the delete-stored-data control', () => {
    it('is disabled with an explanatory note for a guest', () => {
      useAuthStore.setState({ status: 'guest', drive: null })
      render(<DataSection />)

      expect(screen.getByRole('button', { name: /eliminar datos guardados/i })).toBeDisabled()
      expect(screen.getByText(/conecta google drive/i)).toBeInTheDocument()
    })

    it('is disabled with an explanatory note when authenticated without Drive connected', () => {
      useAuthStore.setState({ status: 'authenticated', drive: null })
      render(<DataSection />)

      expect(screen.getByRole('button', { name: /eliminar datos guardados/i })).toBeDisabled()
      expect(screen.getByText(/conecta google drive/i)).toBeInTheDocument()
    })

    it('is enabled with no note once authenticated with Drive connected', () => {
      useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
      render(<DataSection />)

      expect(screen.getByRole('button', { name: /eliminar datos guardados/i })).not.toBeDisabled()
      expect(screen.queryByText(/conecta google drive/i)).not.toBeInTheDocument()
    })

    it('opens a confirmation naming the Drive-and-this-device scope and the other-device caveat', async () => {
      useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
      const user = userEvent.setup()
      render(<DataSection />)

      await user.click(screen.getByRole('button', { name: /eliminar datos guardados/i }))

      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent(/google drive/i)
      expect(dialog).toHaveTextContent(/este dispositivo/i)
      expect(dialog).toHaveTextContent(/otro dispositivo/i)
      expect(mEraseProfileData).not.toHaveBeenCalled()
    })

    it('cancelling the confirmation never calls eraseProfileData', async () => {
      useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
      const user = userEvent.setup()
      render(<DataSection />)
      await user.click(screen.getByRole('button', { name: /eliminar datos guardados/i }))
      const dialog = await screen.findByRole('dialog')

      await user.click(within(dialog).getByRole('button', { name: /^cancelar$/i }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(mEraseProfileData).not.toHaveBeenCalled()
    })

    it('confirming erases via Drive, shows a busy label, resets dataStore to zero, and toasts success', async () => {
      useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
      useDataStore.setState({ movimientos: [movimiento()], status: 'ready' })
      let resolveErase: () => void = () => {}
      mEraseProfileData.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveErase = resolve
        }),
      )
      const loadSpy = vi.spyOn(useDataStore.getState(), 'load').mockResolvedValue(undefined)
      const toastSpy = vi.spyOn(toast, 'success').mockImplementation(() => {})
      const user = userEvent.setup()
      render(<DataSection />)
      await user.click(screen.getByRole('button', { name: /eliminar datos guardados/i }))
      const dialog = await screen.findByRole('dialog')

      await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

      expect(await screen.findByRole('button', { name: /eliminando/i })).toBeDisabled()
      expect(mEraseProfileData).toHaveBeenCalledWith('tok', profile)

      resolveErase()
      await waitFor(() => expect(useDataStore.getState().movimientos).toEqual([]))
      expect(loadSpy).toHaveBeenCalledOnce()
      await waitFor(() =>
        expect(toastSpy).toHaveBeenCalledWith('profile:data.deleteStored.success'),
      )
      toastSpy.mockRestore()
    })

    it('a Drive-stage failure surfaces the Drive-specific error toast, never a success toast', async () => {
      useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
      mEraseProfileData.mockRejectedValue(new EraseError('drive', new Error('boom')))
      const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
      const successSpy = vi.spyOn(toast, 'success').mockImplementation(() => {})
      const user = userEvent.setup()
      render(<DataSection />)
      await user.click(screen.getByRole('button', { name: /eliminar datos guardados/i }))
      const dialog = await screen.findByRole('dialog')

      await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('profile:data.deleteStored.failedDrive'),
      )
      expect(successSpy).not.toHaveBeenCalled()
      errorSpy.mockRestore()
      successSpy.mockRestore()
    })

    it('a local-stage failure surfaces the local-specific error toast, never a success toast', async () => {
      useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
      mEraseProfileData.mockRejectedValue(new EraseError('local', new Error('boom')))
      const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})
      const successSpy = vi.spyOn(toast, 'success').mockImplementation(() => {})
      const user = userEvent.setup()
      render(<DataSection />)
      await user.click(screen.getByRole('button', { name: /eliminar datos guardados/i }))
      const dialog = await screen.findByRole('dialog')

      await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('profile:data.deleteStored.failedLocal'),
      )
      expect(successSpy).not.toHaveBeenCalled()
      errorSpy.mockRestore()
      successSpy.mockRestore()
    })
  })
})
