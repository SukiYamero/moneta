import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountField, parseAmount, formatAmountForInput } from '@/components/shared/AmountField'

describe('parseAmount', () => {
  it('parses a dot-grouped, comma-decimal amount (es-CO)', () => {
    expect(parseAmount('1.234.567,89', 'es-CO')).toBe(1234567.89)
  })

  it('parses a comma-grouped, dot-decimal amount (en-US)', () => {
    expect(parseAmount('1,234,567.89', 'en-US')).toBe(1234567.89)
  })

  it('round-trips formatAmountForInput -> parseAmount for every target locale', () => {
    const amount = 1234567.89
    for (const locale of ['es-CO', 'es-MX', 'es-AR', 'en-US', 'pt-BR']) {
      expect(parseAmount(formatAmountForInput(amount, locale), locale)).toBe(amount)
    }
  })

  it('returns undefined for an empty or whitespace-only string', () => {
    expect(parseAmount('', 'es-CO')).toBeUndefined()
    expect(parseAmount('   ', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for a negative amount', () => {
    expect(parseAmount('-5', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for malformed text', () => {
    expect(parseAmount('abc', 'es-CO')).toBeUndefined()
  })

  it('parses a plain integer with no separators the same in every locale', () => {
    expect(parseAmount('5000', 'es-CO')).toBe(5000)
    expect(parseAmount('5000', 'en-US')).toBe(5000)
  })
})

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
