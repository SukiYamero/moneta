import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast } from '@/components/shared/Toast'
import type { ToastItem } from '@/lib/toastStore'

const item = (overrides: Partial<ToastItem> = {}): ToastItem => ({
  id: 'toast_1',
  variant: 'success',
  message: 'Guardado',
  count: 1,
  ...overrides,
})

describe('Toast', () => {
  it('announces a success toast politely', () => {
    render(<Toast item={item()} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces an error toast assertively', () => {
    render(<Toast item={item({ variant: 'error', message: 'Falló' })} onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders exactly the message the caller passed, never anything else', () => {
    render(
      <Toast item={item({ message: 'No se pudo guardar el movimiento' })} onDismiss={() => {}} />,
    )
    expect(screen.getByText('No se pudo guardar el movimiento')).toBeInTheDocument()
  })

  it('shows the repeat count once a duplicate has collapsed into it', () => {
    render(<Toast item={item({ count: 3 })} onDismiss={() => {}} />)
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('does not show a repeat count for a first-time toast', () => {
    render(<Toast item={item({ count: 1 })} onDismiss={() => {}} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it('is dismissible by keyboard via a labeled, focusable close button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Toast item={item()} onDismiss={onDismiss} />)

    const closeButton = screen.getByRole('button', { name: /descartar/i })
    closeButton.focus()
    await user.keyboard('{Enter}')

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  describe('swipe-to-dismiss', () => {
    const getCard = () => screen.getByRole('status')

    it('dismisses when swiped past the threshold', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} />)
      const card = getCard()

      await user.pointer([
        { keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } },
        { coords: { clientX: -150 } },
        '[/MouseLeft]',
      ])

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('does not dismiss when swiped below the threshold', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} />)
      const card = getCard()

      await user.pointer([
        { keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } },
        { coords: { clientX: -30 } },
        '[/MouseLeft]',
      ])

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('never dismisses on pointercancel, regardless of swipe distance', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} />)
      const card = getCard()

      await user.pointer({ keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } })
      await user.pointer({ coords: { clientX: -200 } })
      card.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(onDismiss).not.toHaveBeenCalled()
    })
  })

  it('sets touch-action so the browser does not fight a horizontal swipe', () => {
    render(<Toast item={item()} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveClass('touch-pan-y')
  })
})
