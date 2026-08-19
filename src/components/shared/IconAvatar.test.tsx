import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Utensils } from 'lucide-react'
import { IconAvatar } from '@/components/shared/IconAvatar'

describe('IconAvatar', () => {
  it('renders the given icon, hidden from the accessibility tree', () => {
    const { container } = render(<IconAvatar icon={Utensils} tint="amber" />)

    const wrapper = container.firstElementChild
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies the size and tint classes', () => {
    const { container } = render(<IconAvatar icon={Utensils} tint="blue" size="lg" />)

    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('size-13')
    expect(wrapper?.className).toContain('text-chart-2')
  })
})
