import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { enUS, es } from 'date-fns/locale'
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
    render(<MovimientoRow movimiento={baseMovimiento} locale="es-CO" dateFnsLocale={es} />)

    expect(screen.getByText('Sueldo')).toBeInTheDocument()
    // The sign attaches to the number, not the currency (specs.md §10.7) —
    // it never leads the string.
    expect(screen.getByText(/\+\d/)).toBeInTheDocument()
  })

  it('prefers the note as title when present', () => {
    render(
      <MovimientoRow
        movimiento={{ ...baseMovimiento, nota: 'Pago quincena' }}
        locale="es-CO"
        dateFnsLocale={es}
      />,
    )

    expect(screen.getByText('Pago quincena')).toBeInTheDocument()
  })

  it('shows the pending badge only when requested', () => {
    const { rerender } = render(
      <MovimientoRow movimiento={baseMovimiento} locale="es-CO" dateFnsLocale={es} />,
    )
    expect(screen.queryByText('Estimado')).not.toBeInTheDocument()

    rerender(
      <MovimientoRow movimiento={baseMovimiento} pending locale="es-CO" dateFnsLocale={es} />,
    )
    expect(screen.getByText('Estimado')).toBeInTheDocument()
  })

  it('is keyboard-activatable when onClick is provided', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <MovimientoRow
        movimiento={baseMovimiento}
        onClick={onClick}
        locale="es-CO"
        dateFnsLocale={es}
      />,
    )

    const row = screen.getByRole('button')
    row.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is not a button when onClick is omitted', () => {
    render(<MovimientoRow movimiento={baseMovimiento} locale="es-CO" dateFnsLocale={es} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders Spanish month labels when the caller passes the es locale', () => {
    render(<MovimientoRow movimiento={baseMovimiento} locale="es-CO" dateFnsLocale={es} />)
    expect(screen.getByText('10 ago')).toBeInTheDocument()
  })

  it('renders the date label in the locale passed by the caller', () => {
    render(<MovimientoRow movimiento={baseMovimiento} locale="es-CO" dateFnsLocale={enUS} />)
    expect(screen.getByText('10 Aug')).toBeInTheDocument()
  })

  it('formats the amount in the locale passed by the caller', () => {
    render(
      <MovimientoRow
        movimiento={{ ...baseMovimiento, moneda: 'USD' }}
        locale="en-US"
        dateFnsLocale={enUS}
      />,
    )
    expect(screen.getByText(/\$\+3,200\.00|US\$\+3,200\.00/)).toBeInTheDocument()
  })
})
