import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YearMenu } from '@/features/history/YearMenu'

describe('YearMenu', () => {
  it('opens the year list on trigger click and marks the selected year', async () => {
    const user = userEvent.setup()
    render(<YearMenu years={[2026, 2025, 2024]} selectedYear={2026} onSelect={() => {}} />)

    await user.click(screen.getByRole('button', { name: /2026/ }))

    const menu = screen.getByRole('listbox')
    expect(within(menu).getByRole('option', { name: '2026' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(menu).getByRole('option', { name: '2024' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('calls onSelect with the chosen year and closes the menu', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<YearMenu years={[2026, 2025, 2024]} selectedYear={2026} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /2026/ }))
    await user.click(screen.getByRole('option', { name: '2024' }))

    expect(onSelect).toHaveBeenCalledWith(2024)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes on outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside">outside</div>
        <YearMenu years={[2026, 2025]} selectedYear={2026} onSelect={() => {}} />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /2026/ }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<YearMenu years={[2026, 2025]} selectedYear={2026} onSelect={() => {}} />)

    await user.click(screen.getByRole('button', { name: /2026/ }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
