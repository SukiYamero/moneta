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
})
