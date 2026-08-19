import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Utensils } from 'lucide-react'
import { TagChip } from '@/components/shared/TagChip'

describe('TagChip', () => {
  it('reflects selection state via aria-pressed', () => {
    const { rerender } = render(<TagChip icon={Utensils} label="Comida" />)
    expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'false')

    rerender(<TagChip icon={Utensils} label="Comida" selected />)
    expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('invokes onClick when tapped', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TagChip icon={Utensils} label="Comida" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Comida' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TagChip icon={Utensils} label="Comida" disabled onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Comida' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('meets the 44px touch-target floor without inflating the visible pill', () => {
    render(<TagChip icon={Utensils} label="Comida" />)

    const button = screen.getByRole('button', { name: 'Comida' })
    expect(button).toHaveClass('min-h-11')
    // the visible pill (border/background) lives on the inner span at its
    // original, smaller designed size — only the button's hit area grows.
    expect(button.firstElementChild).toHaveClass('min-h-9')
  })
})
