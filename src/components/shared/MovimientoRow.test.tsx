import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MovimientoRow } from '@/components/shared/MovimientoRow'
import type { Movimiento } from '@/lib/schema'

const baseMovimiento: Movimiento = {
  id: 'mov_1',
  fecha: '2026-08-10',
  seccion: 'sec_personal',
  categoria: 'Sueldo',
  tipo: 'ingreso',
  monto: 3200,
  moneda: 'COP',
  createdAt: '2026-08-10T09:00:00.000Z',
}

describe('MovimientoRow', () => {
  it('renders the category as title when no note is set, and the signed amount', () => {
    render(<MovimientoRow movimiento={baseMovimiento} />)

    expect(screen.getByText('Sueldo')).toBeInTheDocument()
    expect(screen.getByText(/^\+/)).toBeInTheDocument()
  })

  it('prefers the note as title when present', () => {
    render(<MovimientoRow movimiento={{ ...baseMovimiento, nota: 'Pago quincena' }} />)

    expect(screen.getByText('Pago quincena')).toBeInTheDocument()
  })

  it('shows the pending badge only when requested', () => {
    const { rerender } = render(<MovimientoRow movimiento={baseMovimiento} />)
    expect(screen.queryByText('Estimado')).not.toBeInTheDocument()

    rerender(<MovimientoRow movimiento={baseMovimiento} pending />)
    expect(screen.getByText('Estimado')).toBeInTheDocument()
  })

  it('is keyboard-activatable when onClick is provided', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<MovimientoRow movimiento={baseMovimiento} onClick={onClick} />)

    const row = screen.getByRole('button')
    row.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is not a button when onClick is omitted', () => {
    render(<MovimientoRow movimiento={baseMovimiento} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
