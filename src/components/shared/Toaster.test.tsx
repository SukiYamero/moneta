import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/shared/Toaster'
import { toast, useToastStore } from '@/lib/toastStore'

// toast.success/error are plain functions called from outside React (a
// store, an event handler) — wrapping them in act() here just mirrors what
// React itself does automatically once a real caller triggers them from an
// event handler.
const raise = (fn: () => void) => act(fn)

beforeEach(() => {
  useToastStore.setState({ items: [] })
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
    raise(() => toast.success('Guardado'))

    const card = screen.getByRole('status')
    expect(card).toHaveTextContent('Guardado')
    expect(card.closest('body')).toBe(document.body)
  })

  it('stacks concurrent toasts, oldest nearest the anchored bottom edge', () => {
    render(<Toaster />)
    raise(() => toast.success('Primero'))
    raise(() => toast.success('Segundo'))

    // flex-col-reverse anchors the first DOM child at the bottom edge, so
    // source order stays oldest-first even though it renders visually
    // bottom-up.
    const cards = screen.getAllByRole('status')
    expect(cards.map((card) => card.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Primero'),
        expect.stringContaining('Segundo'),
      ]),
    )
    expect(cards[0]).toHaveTextContent('Primero')
    expect(cards[1]).toHaveTextContent('Segundo')
  })

  it('removes a toast from the stack without disturbing the others when its own close button is used', async () => {
    const user = userEvent.setup()
    render(<Toaster />)
    raise(() => toast.success('Primero'))
    raise(() => toast.success('Segundo'))

    const [firstClose] = screen.getAllByRole('button', { name: /descartar/i })
    await user.click(firstClose!)

    expect(screen.queryByText('Primero')).not.toBeInTheDocument()
    expect(screen.getByText('Segundo')).toBeInTheDocument()
  })
})
