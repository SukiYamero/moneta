import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextField } from '@/components/shared/TextField'

const ControlledHarness = ({ onChange }: { onChange: (value: string) => void }) => {
  const [value, setValue] = useState('')
  return (
    <TextField
      label="Descripción"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Descripción" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument()
  })

  it('calls onChange with the typed value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledHarness onChange={onChange} />)

    await user.type(screen.getByLabelText('Descripción'), 'Café')

    expect(onChange).toHaveBeenLastCalledWith('Café')
  })

  it('has no error node when error is unset', () => {
    render(<TextField label="Descripción" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Descripción')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('wires the error message via aria-describedby and role=alert', () => {
    render(<TextField label="Descripción" value="" onChange={() => {}} error="Campo requerido" />)
    const input = screen.getByLabelText('Descripción')
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('Campo requerido')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('meets the 44px touch target', () => {
    render(<TextField label="Descripción" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Descripción')).toHaveClass('min-h-11')
  })

  it('forwards native input props', () => {
    render(
      <TextField label="Descripción" value="" onChange={() => {}} placeholder="Ej: Almuerzo" />,
    )
    expect(screen.getByPlaceholderText('Ej: Almuerzo')).toBeInTheDocument()
  })
})
