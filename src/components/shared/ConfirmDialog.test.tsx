import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

const noop = () => {}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={noop}
        onConfirm={noop}
        title="¿Eliminar este movimiento?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('labels the dialog with its own title, with no aria props required from the caller', () => {
    render(
      <ConfirmDialog
        open
        onClose={noop}
        onConfirm={noop}
        title="¿Eliminar este movimiento?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
      />,
    )
    expect(screen.getByRole('dialog', { name: '¿Eliminar este movimiento?' })).toBeInTheDocument()
  })

  it('renders the optional description', () => {
    render(
      <ConfirmDialog
        open
        onClose={noop}
        onConfirm={noop}
        title="¿Eliminar?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
      />,
    )
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument()
  })

  it('calls onConfirm, not onClose, when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="¿Eliminar?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={noop}
        title="¿Eliminar?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape, inherited from CenterModal/useOverlay', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={noop}
        title="¿Eliminar?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
      />,
    )

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  // `destructive` maps directly to the confirm button's variant, with no
  // default in either direction — a harmless confirmation (sign out, switch
  // to guest) must never be painted the same as a real delete, or vice versa.
  it.each([
    [true, 'Eliminar', 'destructive'],
    [false, 'Cerrar sesión', 'default'],
  ])('destructive=%s renders the confirm button as variant %s', (destructive, confirmLabel, variant) => {
    render(
      <ConfirmDialog
        open
        onClose={noop}
        onConfirm={noop}
        title="¿Confirmar?"
        confirmLabel={confirmLabel}
        cancelLabel="Cancelar"
        destructive={destructive}
      />,
    )
    expect(screen.getByRole('button', { name: confirmLabel })).toHaveAttribute(
      'data-variant',
      variant,
    )
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
  })
})
