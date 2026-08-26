import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoError } from '@/lib/repo'
import { toast } from '@/lib/toastStore'

const exportMovimientosToCsv = vi.fn()
vi.mock('@/lib/export', () => ({
  exportMovimientosToCsv: (...args: unknown[]) => exportMovimientosToCsv(...args),
}))

import { DataSection } from '@/features/profile/DataSection'

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
    it('renders visibly disabled and stays disabled after a click attempt', async () => {
      const user = userEvent.setup()
      render(<DataSection />)

      const button = screen.getByRole('button', { name: /eliminar datos guardados/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')

      await user.click(button)
      expect(button).toBeDisabled()
    })

    it('carries a note explaining it is not available yet', () => {
      render(<DataSection />)
      expect(screen.getByText(/todavía no disponible/i)).toBeInTheDocument()
    })
  })
})
