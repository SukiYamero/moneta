import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PreContentSkeleton } from '@/features/boot/PreContentSkeleton'

describe('PreContentSkeleton', () => {
  it('renders the persistent chrome and a skeleton, never real content', () => {
    render(<PreContentSkeleton />, { wrapper: MemoryRouter })
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    // HomeLoadingState's own accessible shape: one status announcement,
    // decoration blocks left aria-hidden — not real balance/movement text.
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  // BottomNav's tabs are real NavLinks — without `inert`, a tap here would
  // navigate while the visible content is still the unrelated skeleton.
  // jsdom doesn't enforce `inert`'s browser behavior, so this only checks
  // the attribute is wired.
  it('marks the BottomNav chrome inert, so it cannot be tapped or navigated during this span', () => {
    render(<PreContentSkeleton />, { wrapper: MemoryRouter })
    expect(screen.getByRole('navigation').parentElement).toHaveAttribute('inert')
  })
})
