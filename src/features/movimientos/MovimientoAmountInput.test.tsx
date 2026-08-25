import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MovimientoAmountInput } from '@/features/movimientos/MovimientoAmountInput'

describe('MovimientoAmountInput', () => {
  it('labels the field via aria-label and sets inputMode=decimal', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('inputMode', 'decimal')
    expect(input).not.toHaveAttribute('type', 'number')
  })

  it('renders the currency symbol for the given moneda/locale as a separate, decorative element', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('$')).toHaveAttribute('aria-hidden', 'true')
  })

  it('calls onChange with the raw typed text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MovimientoAmountInput
        value=""
        onChange={onChange}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )

    await user.type(screen.getByLabelText('Monto'), '1')

    expect(onChange).toHaveBeenLastCalledWith('1')
  })

  it('is not aria-invalid for well-formed text under the given locale', () => {
    render(
      <MovimientoAmountInput
        value="1.234,56"
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'false')
  })

  it('is aria-invalid for text that fails to parse under the given locale, even with no error prop', () => {
    render(
      <MovimientoAmountInput
        value="12.34.56"
        onChange={() => {}}
        locale="en-US"
        moneda="USD"
        tipo="gasto"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'true')
  })

  it('wires an explicit error message via aria-describedby and role=alert', () => {
    render(
      <MovimientoAmountInput
        value="100"
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
        error="Ingresa un monto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('Ingresa un monto')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('carries field-sizing: content for auto-width, with a fixed-width fallback overridden via @supports', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    expect(input.className).toContain('[field-sizing:content]')
    expect(input.className).toContain('w-40')
    expect(input.className).toContain('supports-[field-sizing:content]:w-auto')
  })

  it('colors the digits per tipo, mirroring movimientoView.ts — income green, expense plain foreground', () => {
    const { rerender } = render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="ingreso"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveClass('text-success')

    rerender(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveClass('text-foreground')
  })
})
