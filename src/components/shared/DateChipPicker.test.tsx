import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateChipPicker } from '@/components/shared/DateChipPicker'

describe('DateChipPicker', () => {
  it('shows the selected date as a formatted label and starts collapsed', () => {
    render(<DateChipPicker value="2026-08-10" onChange={() => {}} />)

    expect(screen.getByText('10 de agosto')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it('expands the month grid on chip tap', async () => {
    const user = userEvent.setup()
    render(<DateChipPicker value="2026-08-10" onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))

    expect(screen.getByRole('group', { name: 'Selector de fecha' })).toBeInTheDocument()
    expect(screen.getByText('agosto 2026')).toBeInTheDocument()
  })

  it('calls onChange with the tapped day in ISO format and collapses', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateChipPicker value="2026-08-10" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    await user.click(screen.getByRole('button', { name: /15 de agosto/ }))

    expect(onChange).toHaveBeenCalledWith('2026-08-15')
    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it('navigates months without changing the selected value', async () => {
    const user = userEvent.setup()
    render(<DateChipPicker value="2026-08-10" onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))

    expect(screen.getByText('septiembre 2026')).toBeInTheDocument()
  })
})
