import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from '@/components/shared/Toggle'

describe('Toggle', () => {
  it('exposes its state via role=switch/aria-checked', () => {
    render(<Toggle checked aria-label="Notificaciones" onCheckedChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Notificaciones' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('calls onCheckedChange with the flipped value on click', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Toggle checked={false} aria-label="Tema oscuro" onCheckedChange={onCheckedChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('does not fire when disabled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Toggle
        checked={false}
        disabled
        aria-label="Tema oscuro"
        onCheckedChange={onCheckedChange}
      />,
    )

    await user.click(screen.getByRole('switch'))

    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
