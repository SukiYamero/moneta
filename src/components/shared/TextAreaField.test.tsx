import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextAreaField } from '@/components/shared/TextAreaField'

const ControlledHarness = ({
  onChange,
  maxLength,
}: {
  onChange: (value: string) => void
  maxLength?: number
}) => {
  const [value, setValue] = useState('')
  return (
    <TextAreaField
      label="Descripción"
      value={value}
      maxLength={maxLength}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('TextAreaField', () => {
  it('associates the label with the textarea', () => {
    render(<TextAreaField label="Descripción" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument()
  })

  it('calls onChange with the typed value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledHarness onChange={onChange} />)

    await user.type(screen.getByLabelText('Descripción'), 'Café con el equipo')

    expect(onChange).toHaveBeenLastCalledWith('Café con el equipo')
  })

  it('has no error node when error is unset', () => {
    render(<TextAreaField label="Descripción" value="" onChange={() => {}} />)
    const field = screen.getByLabelText('Descripción')
    expect(field).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('wires the error message via aria-describedby and role=alert', () => {
    render(
      <TextAreaField label="Descripción" value="" onChange={() => {}} error="Campo requerido" />,
    )
    const field = screen.getByLabelText('Descripción')
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('Campo requerido')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field.getAttribute('aria-describedby')).toContain(error.id)
  })

  it('renders two rows by default, and does not let the user resize it', () => {
    render(<TextAreaField label="Descripción" value="" onChange={() => {}} />)
    const field = screen.getByLabelText('Descripción') as HTMLTextAreaElement
    expect(field.rows).toBe(2)
    expect(field).toHaveClass('resize-none')
  })

  it('meets the 44px touch target and stops iOS zoom with text-base', () => {
    render(<TextAreaField label="Descripción" value="" onChange={() => {}} />)
    const field = screen.getByLabelText('Descripción')
    expect(field).toHaveClass('min-h-11')
    expect(field).toHaveClass('text-base')
  })

  it('forwards native textarea props', () => {
    render(
      <TextAreaField label="Descripción" value="" onChange={() => {}} placeholder="Ej: Almuerzo" />,
    )
    expect(screen.getByPlaceholderText('Ej: Almuerzo')).toBeInTheDocument()
  })

  it('refuses typing past maxLength', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledHarness onChange={onChange} maxLength={5} />)

    await user.type(screen.getByLabelText('Descripción'), '123456789')

    expect(screen.getByLabelText('Descripción')).toHaveValue('12345')
  })

  it.each([
    [0, false],
    [134, false],
    [135, true],
    [180, true],
  ])(
    'shows the counter only once past three quarters of the 180-char limit (%i chars)',
    (length, expectCounter) => {
      render(
        <TextAreaField
          label="Descripción"
          value={'a'.repeat(length)}
          onChange={() => {}}
          maxLength={180}
        />,
      )
      const counter = screen.queryByText(`${length} de 180 caracteres`)
      if (expectCounter) {
        expect(counter).toBeInTheDocument()
      } else {
        expect(counter).not.toBeInTheDocument()
      }
    },
  )

  it('shows no counter at all when maxLength is unset, no matter the length', () => {
    render(<TextAreaField label="Descripción" value={'a'.repeat(200)} onChange={() => {}} />)
    expect(screen.queryByText(/caracteres/)).not.toBeInTheDocument()
  })
})
