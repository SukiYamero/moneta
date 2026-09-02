import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Toaster } from '@/components/shared/Toaster'
import { i18next } from '@/lib/i18n'
import { setToastsSuppressed, toast, useToastStore, type ToastMessageKey } from '@/lib/toastStore'

const T = (key: ToastMessageKey): string => i18next.t(key)

const raise = (fn: () => void) => act(fn)

beforeEach(() => {
  useToastStore.setState({ items: [] })
  setToastsSuppressed(false)
})

afterEach(() => {
  useToastStore.setState({ items: [] })
})

describe('Toaster', () => {
  it('renders nothing when there is nothing to show', () => {
    const { container } = render(<Toaster />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a raised toast, portaled to document.body', () => {
    render(<Toaster />)
    raise(() => toast.success('toast:demo.saved'))

    const card = screen.getByRole('status')
    expect(card).toHaveTextContent(T('toast:demo.saved'))
    expect(card.closest('body')).toBe(document.body)
  })

  it('stacks above the overlay shells and stays clear of the safe-area/bottom-nav', () => {
    render(<Toaster />)
    raise(() => toast.success('toast:demo.saved'))

    const stack = screen.getByRole('status').parentElement
    expect(stack?.className).toMatch(/(^|\s)z-\[60\](\s|$)/)
    expect(stack).toHaveClass('pb-(--bottom-nav-clearance)')
  })

  it('stacks concurrent toasts, oldest nearest the anchored bottom edge', () => {
    render(<Toaster />)
    raise(() => toast.success('toast:demo.one'))
    raise(() => toast.success('toast:demo.two'))

    const cards = screen.getAllByRole('status')
    expect(cards.map((card) => card.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(T('toast:demo.one')),
        expect.stringContaining(T('toast:demo.two')),
      ]),
    )
    expect(cards[0]).toHaveTextContent(T('toast:demo.one'))
    expect(cards[1]).toHaveTextContent(T('toast:demo.two'))
  })

  it('flags a toast as exiting on close, then removes it once its exit animation finishes, without disturbing the others', () => {
    vi.useFakeTimers()
    render(<Toaster />)
    raise(() => toast.success('toast:demo.one'))
    raise(() => toast.success('toast:demo.two'))

    const [firstClose] = screen.getAllByRole('button', { name: /descartar/i })
    act(() => firstClose!.click())

    expect(screen.getByText(T('toast:demo.one'))).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByText(T('toast:demo.one'))).not.toBeInTheDocument()
    expect(screen.getByText(T('toast:demo.two'))).toBeInTheDocument()
    vi.useRealTimers()
  })
})
