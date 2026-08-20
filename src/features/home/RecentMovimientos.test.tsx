import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { RecentMovimientos } from '@/features/home/RecentMovimientos'

describe('RecentMovimientos', () => {
  it('gives the "Ver todo" link a real 44px touch target (AGENTS.md § UI)', () => {
    render(<RecentMovimientos movimientos={[]} categorias={[]} />, { wrapper: MemoryRouter })

    expect(screen.getByRole('link', { name: /ver todo/i })).toHaveClass('min-h-11')
  })
})
