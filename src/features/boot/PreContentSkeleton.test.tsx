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

  // BottomNav's Home/History/Search tabs are real NavLinks: without this,
  // a tap during this span would navigate the router while the visible
  // content stays the (unrelated) Home skeleton, silently changing where
  // the app lands once boot finishes — and the Add/Profile buttons, wired
  // to noop, would be dead controls that still look pressable. `inert`
  // blocks pointer/keyboard activation and pulls the whole subtree out of
  // the accessibility tree and tab order in a real browser; jsdom (this
  // test's environment) doesn't implement that enforcement, so this only
  // asserts the attribute is wired, not the resulting browser behavior.
  it('marks the BottomNav chrome inert, so it cannot be tapped or navigated during this span', () => {
    render(<PreContentSkeleton />, { wrapper: MemoryRouter })
    expect(screen.getByRole('navigation').parentElement).toHaveAttribute('inert')
  })
})
