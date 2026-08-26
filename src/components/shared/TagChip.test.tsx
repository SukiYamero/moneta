import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Utensils } from 'lucide-react'
import { TagChip } from '@/components/shared/TagChip'

describe('TagChip', () => {
  it('reflects selection state via aria-pressed', () => {
    const { rerender } = render(<TagChip icon={Utensils} label="Comida" tint="amber" />)
    expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'false')

    rerender(<TagChip icon={Utensils} label="Comida" tint="amber" selected />)
    expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('invokes onClick when tapped', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TagChip icon={Utensils} label="Comida" tint="amber" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Comida' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TagChip icon={Utensils} label="Comida" tint="amber" disabled onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Comida' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('meets the 44px touch-target floor without inflating the visible pill', () => {
    render(<TagChip icon={Utensils} label="Comida" tint="amber" />)

    const button = screen.getByRole('button', { name: 'Comida' })
    expect(button).toHaveClass('min-h-11')
    expect(button.firstElementChild).toHaveClass('min-h-9')
  })

  it('carries the tint on the icon regardless of selection', () => {
    const { rerender } = render(<TagChip icon={Utensils} label="Comida" tint="amber" />)
    expect(screen.getByRole('button', { name: 'Comida' }).querySelector('svg')).toHaveClass(
      'text-chart-3',
    )

    rerender(<TagChip icon={Utensils} label="Comida" tint="amber" selected />)
    expect(screen.getByRole('button', { name: 'Comida' }).querySelector('svg')).toHaveClass(
      'text-chart-3',
    )
  })

  it('tints the whole pill per category when selected, not a uniform primary color', () => {
    render(<TagChip icon={Utensils} label="Compras" tint="purple" selected />)

    const pill = screen.getByRole('button', { name: 'Compras' }).firstElementChild
    expect(pill).toHaveClass('border-chart-5/40', 'bg-chart-5/15', 'text-chart-5')
    expect(pill).not.toHaveClass('border-primary/40', 'bg-primary/15', 'text-primary')
  })

  it('leaves an unselected chip on the neutral surface regardless of tint', () => {
    render(<TagChip icon={Utensils} label="Compras" tint="purple" />)

    const pill = screen.getByRole('button', { name: 'Compras' }).firstElementChild
    expect(pill).toHaveClass('border-border-subtle', 'bg-secondary', 'text-fg-secondary')
  })

  it('a selected neutral chip reads visibly different from an unselected one', () => {
    render(<TagChip icon={Utensils} label="Sin categoría" tint="neutral" selected />)

    const pill = screen.getByRole('button', { name: 'Sin categoría' }).firstElementChild
    expect(pill).toHaveClass('border-border-strong', 'bg-muted', 'text-foreground')
    expect(pill).not.toHaveClass('border-border-subtle', 'bg-secondary', 'text-fg-secondary')
  })
})
