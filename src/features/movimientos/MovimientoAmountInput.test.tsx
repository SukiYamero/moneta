import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MovimientoAmountInput,
  type MovimientoAmountInputProps,
} from '@/features/movimientos/MovimientoAmountInput'

type HarnessProps = Omit<MovimientoAmountInputProps, 'value' | 'onChange'> & {
  initialValue?: string
}

/** A real controlled parent — `useMovimientoForm`'s own shape — needed to
 * exercise live reformatting and caret placement across keystrokes; a
 * `value` prop that never updates can't accumulate typed input. */
const ControlledHarness = ({ initialValue = '', ...props }: HarnessProps) => {
  const [value, setValue] = useState(initialValue)
  return <MovimientoAmountInput {...props} value={value} onChange={setValue} />
}

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

  it('renders the currency symbol as a decorative element, plus an invisible mirror that balances it for centering', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const symbols = screen.getAllByText('$')
    expect(symbols).toHaveLength(2)
    expect(symbols[0]).toHaveAttribute('aria-hidden', 'true')
    expect(symbols[0]).not.toHaveClass('invisible')
    expect(symbols[1]).toHaveAttribute('aria-hidden', 'true')
    expect(symbols[1]).toHaveClass('invisible')
  })

  it('the input sits between the real symbol and its invisible mirror, both siblings inside the same centered row', () => {
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
    const row = input.parentElement
    expect(row?.children).toHaveLength(3)
    expect(row?.children[1]).toBe(input)
  })

  it("the row itself is w-full — jsdom has no layout engine to prove it, but a real-browser repro (specs.md §10.45) showed the row is otherwise shrink-to-fit under its flex-col items-center parent, making the input's max-w-[calc(100%-3rem)] resolve against the row's own unbounded content width instead of the sheet's real one, so a six-digit PEN amount overflowed the sheet with the clamp doing nothing", () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const row = screen.getByLabelText('Monto').parentElement
    expect(row?.className).toContain('w-full')
  })

  it('calls onChange with the raw typed text for a short, ungrouped amount', async () => {
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

  it('carries field-sizing: content for auto-width, with a fixed-width fallback overridden via @supports, bounded by a relative max-width', () => {
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
    expect(input.className).toContain('max-w-[calc(100%-3rem)]')
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

  describe('live locale grouping', () => {
    it('groups digits as the user types under a dot-grouping locale', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      expect(input).toHaveValue('1.234.567')
    })

    it('groups digits as the user types under a comma-grouping locale', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="en-US" moneda="USD" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      expect(input).toHaveValue('1,234,567')
    })

    it('groups digits as the user types under a space-grouping locale', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="fr-FR" moneda="USD" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      const expected = new Intl.NumberFormat('fr-FR').format(1234567)
      expect(input).toHaveValue(expected)
    })

    it('keeps a trailing decimal separator mid-entry, on the way to a fraction', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1,')

      expect(input).toHaveValue('1,')
    })

    it('does not collapse a trailing fraction zero', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1,50')

      expect(input).toHaveValue('1,50')
    })

    it('handles a paste of a plain digit string, grouping it', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.click(input)
      await user.paste('1234567')

      expect(input).toHaveValue('1.234.567')
    })

    it('leaves malformed pasted text untouched, still flagged invalid downstream', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.click(input)
      await user.paste('abc')

      expect(input).toHaveValue('abc')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('caret placement across a live reformat', () => {
    it('does not send the caret to the end when a separator is inserted ahead of it', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // "1.234" -> place caret at index 3 (right after "1.2", before "34")
      // and type "9": the browser splices it in as "1.2934", which regroups
      // to "12.934" — 3 digits now precede the caret ("1", "2", "9"), so the
      // caret must land right after the "9", not at the string's end.
      await user.type(input, '9', { initialSelectionStart: 3, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.934')
      expect(input.selectionStart).toBe(4)
      expect(input.selectionEnd).toBe(4)
    })

    it('keeps the caret in place when backspacing across a grouping separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // caret right after the separator (index 3); backspace removes it,
      // the separator is derived so it reappears, and the caret must land
      // back in the same visual spot — still right after it, not wedged
      // before it (which would misdirect the next keystroke).
      await user.type(input, '{backspace}', { initialSelectionStart: 3, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.345')
      expect(input.selectionStart).toBe(3)
    })

    it('deleting a grouping separator directly is a no-op — it is derived, not literal', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // select just the "." (index 2 to 3) and delete it
      await user.type(input, '{delete}', { initialSelectionStart: 2, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.345')
    })
  })
})
