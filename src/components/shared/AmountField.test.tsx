import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountField } from '@/components/shared/AmountField'

describe('AmountField', () => {
  it('associates the label with the input and sets inputMode=decimal', () => {
    render(<AmountField label="Monto" value="" onChange={() => {}} locale="es-CO" />)
    const input = screen.getByLabelText('Monto')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('inputMode', 'decimal')
    expect(input).not.toHaveAttribute('type', 'number')
  })

  it('calls onChange with the raw typed text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AmountField label="Monto" value="" onChange={onChange} locale="es-CO" />)

    await user.type(screen.getByLabelText('Monto'), '1')

    expect(onChange).toHaveBeenLastCalledWith('1')
  })

  it('is not aria-invalid for well-formed text under the given locale', () => {
    render(<AmountField label="Monto" value="1.234,56" onChange={() => {}} locale="es-CO" />)
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'false')
  })

  it('is aria-invalid for text that fails to parse under the given locale, even with no error prop', () => {
    render(<AmountField label="Monto" value="12.34.56" onChange={() => {}} locale="en-US" />)
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'true')
  })

  it('is not aria-invalid for a non-positive amount typed on the way to a valid one, e.g. "0" toward "0,50"', () => {
    render(<AmountField label="Monto" value="0" onChange={() => {}} locale="es-CO" />)
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'false')
  })

  it('is not aria-invalid for an empty value with no error prop', () => {
    render(<AmountField label="Monto" value="" onChange={() => {}} locale="es-CO" />)
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'false')
  })

  it('wires an explicit error message via aria-describedby and role=alert', () => {
    render(
      <AmountField
        label="Monto"
        value="100"
        onChange={() => {}}
        locale="es-CO"
        error="El monto es requerido"
      />,
    )
    const input = screen.getByLabelText('Monto')
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('El monto es requerido')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('meets the 44px touch target', () => {
    render(<AmountField label="Monto" value="" onChange={() => {}} locale="es-CO" />)
    expect(screen.getByLabelText('Monto')).toHaveClass('min-h-11')
  })
})
