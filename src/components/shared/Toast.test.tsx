import { Profiler } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast } from '@/components/shared/Toast'
import type { ToastItem } from '@/lib/toastStore'
import { dispatchTimestampedPointer } from '@/test/pointerEvents'

const item = (overrides: Partial<ToastItem> = {}): ToastItem => ({
  id: 'toast_1',
  variant: 'success',
  message: 'Guardado',
  count: 1,
  exiting: false,
  ...overrides,
})

describe('Toast', () => {
  it('announces a success toast politely', () => {
    render(<Toast item={item()} onDismiss={() => {}} onExited={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces an error toast assertively', () => {
    render(
      <Toast
        item={item({ variant: 'error', message: 'Falló' })}
        onDismiss={() => {}}
        onExited={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders exactly the message the caller passed, never anything else', () => {
    render(
      <Toast
        item={item({ message: 'No se pudo guardar el movimiento' })}
        onDismiss={() => {}}
        onExited={() => {}}
      />,
    )
    expect(screen.getByText('No se pudo guardar el movimiento')).toBeInTheDocument()
  })

  it('shows the repeat count once a duplicate has collapsed into it', () => {
    render(<Toast item={item({ count: 3 })} onDismiss={() => {}} onExited={() => {}} />)
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('does not show a repeat count for a first-time toast', () => {
    render(<Toast item={item({ count: 1 })} onDismiss={() => {}} onExited={() => {}} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it('is dismissible by keyboard via a labeled, focusable close button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />)

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
      render(<Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />)
      const card = getCard()

      await user.pointer([
        { keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } },
        { coords: { clientX: -150 } },
        '[/MouseLeft]',
      ])

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('dismisses on a fast short swipe that never reaches the distance threshold', () => {
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />)
      const card = getCard()

      dispatchTimestampedPointer(card, 'pointerdown', { clientX: 0 }, 1000)
      dispatchTimestampedPointer(card, 'pointermove', { clientX: -30 }, 1010)
      dispatchTimestampedPointer(card, 'pointerup', { clientX: -30 }, 1010)

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('does not dismiss when swiped below the threshold, and snaps back animated rather than staying stuck at the swipe offset', () => {
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />)
      const card = getCard()

      // Explicit, comfortably slow timestamps on every event — real userEvent timing is
      // too fast and jitter-prone to reliably stay under the velocity threshold here.
      dispatchTimestampedPointer(card, 'pointerdown', { clientX: 0 }, 1000)
      dispatchTimestampedPointer(card, 'pointermove', { clientX: -30 }, 1200)
      dispatchTimestampedPointer(card, 'pointerup', { clientX: -30 }, 1200)

      expect(onDismiss).not.toHaveBeenCalled()
      expect(card.style.transform).toBe('')
      expect(card.style.opacity).toBe('')
      expect(card.style.transitionDuration).toBe('')
    })

    it('never dismisses on pointercancel, regardless of swipe distance, and fully clears the visual transform/opacity', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />)
      const card = getCard()

      await user.pointer({ keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } })
      await user.pointer({ coords: { clientX: -200 } })
      expect(card.style.transform).not.toBe('')

      card.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(onDismiss).not.toHaveBeenCalled()
      expect(card.style.transform).toBe('')
      expect(card.style.opacity).toBe('')
      expect(card.style.transitionDuration).toBe('')
    })

    it('resets fully when the swipe is released outside the window (lostpointercapture), the only event guaranteed to fire there', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(<Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />)
      const card = getCard()

      await user.pointer({ keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } })
      await user.pointer({ coords: { clientX: -200 } })
      expect(card.style.transform).not.toBe('')

      card.dispatchEvent(new Event('lostpointercapture', { bubbles: true }))

      expect(onDismiss).not.toHaveBeenCalled()
      expect(card.style.transform).toBe('')
      expect(card.style.opacity).toBe('')
      expect(card.style.transitionDuration).toBe('')
    })

    it('tracks a pointermove flood entirely through the card style, with zero React re-renders', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      let renderCount = 0
      render(
        <Profiler id="toast" onRender={() => (renderCount += 1)}>
          <Toast item={item()} onDismiss={onDismiss} onExited={() => {}} />
        </Profiler>,
      )
      const card = getCard()
      renderCount = 0

      await user.pointer({ keys: '[MouseLeft>]', target: card, coords: { clientX: 0 } })
      for (const clientX of [-10, -20, -30, -40, -50, -60, -70]) {
        await user.pointer({ coords: { clientX } })
      }
      expect(card.style.transform).toBe('translateX(-70px)')
      expect(renderCount).toBe(0)

      await user.pointer('[/MouseLeft]')
      expect(renderCount).toBe(0)
    })
  })

  it('sets touch-action so the browser does not fight a horizontal swipe', () => {
    render(<Toast item={item()} onDismiss={() => {}} onExited={() => {}} />)
    expect(screen.getByRole('status')).toHaveClass('touch-pan-y')
  })

  describe('action', () => {
    it('renders no action button when the item carries none', () => {
      render(<Toast item={item()} onDismiss={() => {}} onExited={() => {}} />)
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it("renders the action's own label, resolved via its namespace-prefixed key", () => {
      render(
        <Toast
          item={item({ action: { labelKey: 'update:reload', onAction: () => {} } })}
          onDismiss={() => {}}
          onExited={() => {}}
        />,
      )
      expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    })

    it('taking the action calls onAction and then dismisses the toast', async () => {
      const user = userEvent.setup()
      const onAction = vi.fn()
      const onDismiss = vi.fn()
      render(
        <Toast
          item={item({ action: { labelKey: 'update:reload', onAction } })}
          onDismiss={onDismiss}
          onExited={() => {}}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Recargar' }))

      expect(onAction).toHaveBeenCalledOnce()
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(onAction.mock.invocationCallOrder[0]).toBeLessThan(
        onDismiss.mock.invocationCallOrder[0]!,
      )
    })
  })

  describe('exit animation', () => {
    it('animates out and calls onExited once the exit finishes, without calling it immediately', () => {
      vi.useFakeTimers()
      const onExited = vi.fn()
      const { rerender } = render(<Toast item={item()} onDismiss={() => {}} onExited={onExited} />)

      rerender(<Toast item={item({ exiting: true })} onDismiss={() => {}} onExited={onExited} />)
      expect(onExited).not.toHaveBeenCalled()

      vi.advanceTimersByTime(200)
      expect(onExited).toHaveBeenCalledOnce()
      vi.useRealTimers()
    })

    it('fades out in place for a non-drag dismissal, with no horizontal slide', () => {
      vi.useFakeTimers()
      const { rerender } = render(<Toast item={item()} onDismiss={() => {}} onExited={() => {}} />)
      const card = screen.getByRole('status')

      rerender(<Toast item={item({ exiting: true })} onDismiss={() => {}} onExited={() => {}} />)

      expect(card.style.transform).toBe('')
      expect(card.style.opacity).toBe('0')
      vi.useRealTimers()
    })
  })
})
