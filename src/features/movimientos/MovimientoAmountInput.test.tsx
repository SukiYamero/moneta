import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/components/shared/BottomSheet'
import {
  MovimientoAmountInput,
  type MovimientoAmountInputProps,
} from '@/features/movimientos/MovimientoAmountInput'

const stubMatchMedia = (coarsePointer: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)' && coarsePointer,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

type HarnessProps = Omit<MovimientoAmountInputProps, 'value' | 'onChange'> & {
  initialValue?: string
}

const ControlledHarness = ({ initialValue = '', ...props }: HarnessProps) => {
  const [value, setValue] = useState(initialValue)
  return <MovimientoAmountInput {...props} value={value} onChange={setValue} />
}

describe('MovimientoAmountInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('the on-screen pad is gated to touch devices (coarse pointer)', () => {
    it('renders the pad at compact key height and sets inputMode=none on a coarse-pointer (touch) device', async () => {
      stubMatchMedia(true)
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      expect(input).toHaveAttribute('inputMode', 'none')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1' })).toHaveClass('min-h-13.25')
    })

    it('renders no pad at all, and leaves inputMode=decimal, on a fine-pointer (desktop) device', async () => {
      stubMatchMedia(false)
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      expect(input).toHaveAttribute('inputMode', 'decimal')
      await user.click(input)
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()

      await user.keyboard('123')
      expect(input).toHaveValue('123')
    })
  })

  it('labels the field via aria-label, and never renders type=number', () => {
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

  it("the symbol/input/mirror row is w-full, so the input's max-width clamp resolves against a definite width rather than its own shrink-to-fit content", () => {
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
    it.each([
      { locale: 'es-CO', moneda: 'COP' as const, expected: '1.234.567' },
      { locale: 'en-US', moneda: 'USD' as const, expected: '1,234,567' },
    ])('groups digits as the user types under $locale', async ({ locale, moneda, expected }) => {
      const user = userEvent.setup()
      render(<ControlledHarness locale={locale} moneda={moneda} tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      expect(input).toHaveValue(expected)
    })

    // fr-FR's group separator is not a stable literal across ICU versions.
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

  describe('the digits render at one fixed size', () => {
    it('uses the same size for a short amount and a long one', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234')
      expect(input).toHaveValue('1.234')
      expect(input).toHaveClass('text-[2.625rem]')

      await user.type(input, '567890123')

      expect(input).toHaveValue('1.234.567.890.123')
      expect(input).toHaveClass('text-[2.625rem]')
    })
  })

  describe('caret placement across a live reformat', () => {
    it('does not send the caret to the end when a separator is inserted ahead of it', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.type(input, '9', { initialSelectionStart: 3, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.934')
      expect(input.selectionStart).toBe(4)
      expect(input.selectionEnd).toBe(4)
    })

    it('keeps the caret in place when backspacing across a grouping separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.type(input, '{backspace}', { initialSelectionStart: 3, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.345')
      expect(input.selectionStart).toBe(3)
    })

    it('deleting a grouping separator directly is a no-op — it is derived, not literal', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.type(input, '{delete}', { initialSelectionStart: 2, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.345')
    })
  })

  describe('on-screen keypad (native software keyboard suppressed)', () => {
    it.each([
      { locale: 'es-CO', moneda: 'COP' as const, separator: ',' },
      { locale: 'en-US', moneda: 'USD' as const, separator: '.' },
    ])(
      "renders the decimal key labeled with the locale's own separator ($locale)",
      async ({ locale, moneda, separator }) => {
        const user = userEvent.setup()
        render(<ControlledHarness locale={locale} moneda={moneda} tipo="gasto" />)
        await user.click(screen.getByLabelText('Monto'))
        expect(screen.getByRole('button', { name: 'Separador decimal' })).toHaveTextContent(
          separator,
        )
      },
    )

    it('tapping digit keys appends through the same live-grouping pipeline as typing', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      for (const digit of ['1', '2', '3', '4', '5', '6', '7']) {
        await user.click(screen.getByRole('button', { name: digit }))
      }

      expect(screen.getByLabelText('Monto')).toHaveValue('1.234.567')
    })

    it('tapping the decimal key inserts the locale separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12" locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.click(screen.getByRole('button', { name: 'Separador decimal' }))
      await user.click(screen.getByRole('button', { name: '5' }))

      expect(screen.getByLabelText('Monto')).toHaveValue('12,5')
    })

    it('disables the decimal key once the value already has a separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12,5" locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      expect(screen.getByRole('button', { name: 'Separador decimal' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })

    it('disables delete when the value is empty', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      expect(screen.getByRole('button', { name: 'Borrar' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })

    it('tapping delete removes the last digit through the same reformat pipeline as backspace', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.click(screen.getByRole('button', { name: 'Borrar' }))

      expect(screen.getByLabelText('Monto')).toHaveValue('123')
    })

    it('deletes the current selection instead of just the last character, when one exists', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.click(input)
      input.setSelectionRange(3, 6)
      await user.click(screen.getByRole('button', { name: 'Borrar' }))

      expect(input.value).toBe('12')
    })

    it('inserts a tapped digit at the current caret position, not just at the end', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.click(input)
      input.setSelectionRange(3, 3)
      await user.click(screen.getByRole('button', { name: '9' }))

      expect(input.value).toBe('12.934')
    })

    it('deletes the digit before an auto-inserted grouping separator, not the separator itself', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.000" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.click(input)
      input.setSelectionRange(2, 2)
      await user.click(screen.getByRole('button', { name: 'Borrar' }))

      expect(input.value).toBe('0')
    })

    it('deletes the decimal separator itself when the caret sits right after it, unlike a grouping separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12,5" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      await user.click(input)
      input.setSelectionRange(3, 3)
      await user.click(screen.getByRole('button', { name: 'Borrar' }))

      expect(input.value).toBe('125')
    })
  })

  describe("the keypad bleeds past the sheet's own side padding to the true screen edges", () => {
    // jsdom has no layout engine, so this asserts the classes, not the geometry.
    it("keeps its bleed numbers locked to BottomSheet's own scrollable-body padding", async () => {
      render(
        <BottomSheet open onClose={() => {}} ariaLabel="Sheet de prueba">
          <p>contenido</p>
        </BottomSheet>,
      )
      const sheetBody = document.querySelector('.overflow-y-auto') as HTMLElement
      const sheetPaddingMatch = [...sheetBody.classList]
        .map((c) => /^px-(\d+(?:\.\d+)?)$/.exec(c))
        .find((m) => m !== null)
      const sheetPaddingUnits = Number(sheetPaddingMatch?.[1])
      expect(sheetPaddingUnits).toBeGreaterThan(0)

      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))
      const grid = screen.getByRole('button', { name: '1' }).parentElement as HTMLElement

      const gridPaddingMatch = [...grid.classList]
        .map((c) => /^px-(\d+(?:\.\d+)?)$/.exec(c))
        .find((m) => m !== null)
      const gridMarginMatch = [...grid.classList]
        .map((c) => /^-mx-(\d+(?:\.\d+)?)$/.exec(c))
        .find((m) => m !== null)
      const gridWidthMatch = [...grid.classList]
        .map((c) => /^w-\[calc\(100%\+(\d+(?:\.\d+)?)rem\)\]$/.exec(c))
        .find((m) => m !== null)

      expect(Number(gridPaddingMatch?.[1])).toBe(sheetPaddingUnits)
      expect(Number(gridMarginMatch?.[1])).toBe(sheetPaddingUnits)
      expect(Number(gridWidthMatch?.[1])).toBe(sheetPaddingUnits * 0.25 * 2)
    })
  })

  describe('keypad shows only while the amount field is focused', () => {
    it('renders no keypad at all before the input is focused', () => {
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })

    it('shows the keypad once the input is focused', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)

      await user.click(screen.getByLabelText('Monto'))

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })

    it('hides the keypad once focus moves to an unrelated element entirely', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <input aria-label="Nota" />
        </div>,
      )
      await user.click(screen.getByLabelText('Monto'))
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(screen.getByLabelText('Nota'))

      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })

    it('keeps the keypad open, and the tap still registers, across repeated taps on one of its own keys', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.click(screen.getByRole('button', { name: '7' }))
      await user.click(screen.getByRole('button', { name: '7' }))

      expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
      expect(screen.getByLabelText('Monto')).toHaveValue('77')
    })

    it('keeps the keypad open when focus tabs from the input onto one of the pad’s own keys', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.tab()

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })
  })

  describe('dismissing on an outside tap that never fires a native blur', () => {
    // iOS Safari fires no blur when the tap target is not focusable; jsdom's own
    // click moves focus to <body> regardless, so mousedown+preventDefault
    // reproduces WebKit's DOM state.
    const OutsideNonFocusableTarget = ({ onMouseDown }: { onMouseDown?: () => void }) => (
      <div
        data-testid="outside"
        onMouseDown={(event) => {
          event.preventDefault()
          onMouseDown?.()
        }}
      >
        dead space
      </div>
    )

    it('closes the pad on an outside tap even when the target never lets native focus move', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(screen.getByTestId('outside'))

      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()
    })

    it('tapping the amount field again after such a dismissal reopens the pad', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      await user.click(screen.getByTestId('outside'))
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()

      await user.click(input)

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })

    it('a tap on one of the pad’s own keys never triggers the outside-dismiss path', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')
      await user.click(input)

      await user.click(screen.getByRole('button', { name: '7' }))

      expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
      expect(input).toHaveValue('7')
    })

    // A click is re-hit-tested against the post-collapse DOM on touch in Blink.
    it('does not close the pad on pointerdown alone — only once the pointer lifts, so an in-flight tap on a control behind the pad cannot be retargeted by an early collapse', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const outside = screen.getByTestId('outside')
      await user.pointer({ keys: '[MouseLeft>]', target: outside })
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(input).toHaveFocus()

      await user.pointer('[/MouseLeft]')
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()
    })

    it('never dismisses on pointercancel, even for a gesture that began outside', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const outside = screen.getByTestId('outside')
      outside.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      )
      outside.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })

    // The browser's own mousedown default action focuses an outside control
    // before pointerup, firing a real native blur first.
    it('a native blur from tapping a genuinely focusable outside control is deferred the same way, so the pad does not collapse before the pointer lifts', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <button type="button">Elsewhere</button>
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const outside = screen.getByRole('button', { name: 'Elsewhere' })
      await user.pointer({ keys: '[MouseLeft>]', target: outside })
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.pointer('[/MouseLeft]')
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })
  })

  describe('a gesture that starts on the pad never dismisses it, whatever the browser did with focus in between', () => {
    it('stays open and restores focus to the input when a mid-gesture blur lands on a focusable ancestor outside the wrapper', async () => {
      const user = userEvent.setup()
      render(
        <div tabIndex={-1} data-testid="dialog-panel">
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const gridContainer = screen.getByRole('button', { name: '1' }).parentElement as HTMLElement
      const dialogPanel = screen.getByTestId('dialog-panel')

      gridContainer.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      )
      dialogPanel.focus()
      gridContainer.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(input).toHaveFocus()
    })

    // On WebKit the platform-driven focus walk lands only after pointerup, so no
    // blur listener has a gesture window left to protect this.
    it('stays open when the ancestor focus-walk happens only after pointerup has already resolved the gesture as inside', async () => {
      const user = userEvent.setup()
      render(
        <div tabIndex={-1} data-testid="dialog-panel">
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const gridContainer = screen.getByRole('button', { name: '1' }).parentElement as HTMLElement
      const dialogPanel = screen.getByTestId('dialog-panel')

      gridContainer.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      )
      gridContainer.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
      )
      dialogPanel.focus()

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })
  })

  describe('the dismiss-free zone is the input and the pad, not the whole field column', () => {
    it('dismisses the pad on a tap on the visible currency symbol beside the input', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="7" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(screen.getAllByText('$')[0]!)

      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()
    })

    it('dismisses the pad on a tap on the label above the field', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(screen.getByText('Monto'))

      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()
    })

    it('never dismisses on a tap that lands back on the input itself', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(input)

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(input).toHaveFocus()
    })
  })

  describe('a keyboard user can still leave the pad', () => {
    it('closes the pad when Tab moves focus past its last key with no pointer gesture involved', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <button type="button">After</button>
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      for (let i = 0; i < 13; i += 1) await user.tab()

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })
  })
})
