import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/shared/Toaster'
import { i18next } from '@/lib/i18n'
import { setToastsSuppressed, toast, useToastStore, type ToastMessageKey } from '@/lib/toastStore'

// Resolved lazily, at call time — i18next.language isn't forced to 'es'
// until src/test/setup.ts's `beforeAll` runs, which is after this module's
// own top-level code already evaluated.
const T = (key: ToastMessageKey): string => i18next.t(key)

// toast.success/error are plain functions called from outside React (a
// store, an event handler) — wrapping them in act() here just mirrors what
// React itself does automatically once a real caller triggers them from an
// event handler.
const raise = (fn: () => void) => act(fn)

beforeEach(() => {
  useToastStore.setState({ items: [] })
  // Toaster is a leaf that doesn't know about suppression policy itself
  // (AppLock drives it) — this suite exercises the stack in isolation, so
  // it opts in directly rather than rendering AppLock.
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

    // flex-col-reverse anchors the first DOM child at the bottom edge, so
    // source order stays oldest-first even though it renders visually
    // bottom-up.
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

  it('removes a toast from the stack without disturbing the others when its own close button is used', async () => {
    const user = userEvent.setup()
    render(<Toaster />)
    raise(() => toast.success('toast:demo.one'))
    raise(() => toast.success('toast:demo.two'))

    const [firstClose] = screen.getAllByRole('button', { name: /descartar/i })
    await user.click(firstClose!)

    expect(screen.queryByText(T('toast:demo.one'))).not.toBeInTheDocument()
    expect(screen.getByText(T('toast:demo.two'))).toBeInTheDocument()
  })
})
